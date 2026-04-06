#!/usr/bin/env node

/**
 * SECRET AGE CHECKER
 *
 * Monitors age of secrets and alerts when rotation is needed.
 * Helps maintain security compliance by tracking secret lifecycle.
 *
 * Usage:
 *   node scripts/check-secret-age.js
 *
 * Requirements:
 *   - AWS CLI configured (for AWS Secrets Manager)
 *   - GitHub CLI configured (for GitHub Secrets)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const ROTATION_POLICIES = {
  JWT_SECRET: 90, // days
  JWT_REFRESH_SECRET: 90,
  DATABASE_URL: 180,
  REDIS_PASSWORD: 90,
  SMTP_PASS: 180,
  TWILIO_AUTH_TOKEN: 90,
  SMT_API_SECRET: 90,
};

const SECRETS_MANAGER = process.env.SECRETS_MANAGER || 'github';
const ENVIRONMENT = process.env.ENVIRONMENT || 'production';

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Get secret metadata from GitHub Secrets
 */
function getGitHubSecretAge(secretName) {
  try {
    // GitHub Secrets API doesn't provide last updated date
    // Using git log as fallback
    const command = `git log --all -p -S "${secretName}" --format="%aI" -- .github/workflows/ | head -1`;
    const output = execSync(command, { encoding: 'utf-8' }).trim();

    if (!output) {
      return null;
    }

    const lastUpdated = new Date(output);
    const now = new Date();
    const ageInDays = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));

    return ageInDays;
  } catch (error) {
    return null;
  }
}

/**
 * Get secret metadata from AWS Secrets Manager
 */
function getAWSSecretAge(secretName) {
  try {
    const secretId = `foodwaste/${ENVIRONMENT}/${secretName.toLowerCase().replace(/_/g, '-')}`;
    const command = `aws secretsmanager describe-secret --secret-id ${secretId} --query 'LastChangedDate' --output text`;
    const output = execSync(command, { encoding: 'utf-8' }).trim();

    if (!output || output === 'None') {
      return null;
    }

    const lastUpdated = new Date(output);
    const now = new Date();
    const ageInDays = Math.floor((now - lastUpdated) / (1000 * 60 * 60 * 24));

    return ageInDays;
  } catch (error) {
    return null;
  }
}

/**
 * Get secret age based on secrets manager
 */
function getSecretAge(secretName) {
  switch (SECRETS_MANAGER) {
    case 'github':
      return getGitHubSecretAge(secretName);
    case 'aws':
      return getAWSSecretAge(secretName);
    default:
      return null;
  }
}

/**
 * Check all secrets and generate report
 */
function checkSecrets() {
  log('\n================================================', 'blue');
  log('SECRET AGE REPORT', 'blue');
  log('================================================', 'blue');
  log(`Environment: ${ENVIRONMENT}`);
  log(`Secrets Manager: ${SECRETS_MANAGER}`);
  log('================================================\n', 'blue');

  const results = [];
  let criticalCount = 0;
  let warningCount = 0;

  for (const [secretName, maxAge] of Object.entries(ROTATION_POLICIES)) {
    const age = getSecretAge(secretName);

    const status = {
      name: secretName,
      age: age !== null ? age : 'Unknown',
      maxAge,
      status: 'OK',
      color: 'green',
    };

    if (age === null) {
      status.status = 'Unknown';
      status.color = 'yellow';
      warningCount++;
    } else if (age >= maxAge) {
      status.status = 'CRITICAL - ROTATION REQUIRED';
      status.color = 'red';
      criticalCount++;
    } else if (age >= maxAge * 0.8) {
      status.status = 'WARNING - Rotation due soon';
      status.color = 'yellow';
      warningCount++;
    }

    results.push(status);
  }

  // Print results
  console.log('Secret Name                | Age (days) | Max Age | Status');
  console.log('--------------------------------------------------------');

  results.forEach((result) => {
    const agePadded = String(result.age).padEnd(10);
    const maxAgePadded = String(result.maxAge).padEnd(8);
    const namePadded = result.name.padEnd(25);

    log(`${namePadded} | ${agePadded} | ${maxAgePadded} | ${result.status}`, result.color);
  });

  console.log('--------------------------------------------------------\n');

  // Summary
  log(`Total Secrets: ${results.length}`, 'blue');
  log(`Critical: ${criticalCount}`, criticalCount > 0 ? 'red' : 'green');
  log(`Warnings: ${warningCount}`, warningCount > 0 ? 'yellow' : 'green');
  log(`OK: ${results.length - criticalCount - warningCount}`, 'green');

  // Recommendations
  if (criticalCount > 0) {
    log('\n================================================', 'red');
    log('CRITICAL: IMMEDIATE ACTION REQUIRED', 'red');
    log('================================================', 'red');
    log('Run: ./scripts/rotate-secrets.sh all', 'red');
    log('Or rotate individual secrets as needed\n', 'red');
  } else if (warningCount > 0) {
    log('\n================================================', 'yellow');
    log('WARNING: Plan secret rotation soon', 'yellow');
    log('================================================', 'yellow');
    log('Schedule rotation within the next 2 weeks\n', 'yellow');
  } else {
    log('\n================================================', 'green');
    log('All secrets are within rotation policy', 'green');
    log('================================================\n', 'green');
  }

  // Exit with error code if critical
  if (criticalCount > 0) {
    process.exit(1);
  }
}

/**
 * Generate secret rotation report (JSON)
 */
function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    secretsManager: SECRETS_MANAGER,
    secrets: [],
  };

  for (const [secretName, maxAge] of Object.entries(ROTATION_POLICIES)) {
    const age = getSecretAge(secretName);

    report.secrets.push({
      name: secretName,
      age: age !== null ? age : null,
      maxAge,
      needsRotation: age !== null && age >= maxAge,
      daysUntilRotation: age !== null ? maxAge - age : null,
    });
  }

  const reportPath = path.join(__dirname, '..', 'reports', 'secret-age-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`\nReport saved to: ${reportPath}`, 'blue');
}

// Main execution
try {
  checkSecrets();
  generateReport();
} catch (error) {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
}

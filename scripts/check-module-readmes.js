#!/usr/bin/env node

/**
 * CI/CD Script: Check for Missing Module README Files
 *
 * Purpose: Ensure all backend modules have documentation (README.md)
 * Usage: node scripts/check-module-readmes.js
 * Exit Codes:
 *   0 - All modules have READMEs
 *   1 - Missing READMEs found (fails CI/CD)
 *
 * @version 1.0.0
 * @since 2025-11-21
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_SRC_PATH = path.join(__dirname, '../apps/food-waste-backend/src');
const IGNORE_DIRS = [
  'node_modules',
  'dist',
  'coverage',
  '__tests__',
  'test',
  'tests',
  // Not true modules
  'utils',
  'interfaces',
  'types',
  'constants',
];

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Check if a directory is a NestJS module
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} - True if directory contains a *.module.ts file
 */
function isModule(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    return files.some((file) => file.endsWith('.module.ts'));
  } catch (error) {
    return false;
  }
}

/**
 * Check if a directory has a README.md file
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} - True if README.md exists
 */
function hasReadme(dirPath) {
  const readmePath = path.join(dirPath, 'README.md');
  return fs.existsSync(readmePath);
}

/**
 * Get all module directories recursively
 * @param {string} dir - Directory to scan
 * @param {string[]} results - Accumulator for results
 * @returns {string[]} - Array of module directory paths
 */
function findModules(dir, results = []) {
  if (!fs.existsSync(dir)) {
    console.error(`${colors.red}✗ Error: Directory not found: ${dir}${colors.reset}`);
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirName = entry.name;
    if (IGNORE_DIRS.includes(dirName)) continue;

    const fullPath = path.join(dir, dirName);

    // Check if this is a module directory
    if (isModule(fullPath)) {
      results.push(fullPath);
    }

    // Recursively scan subdirectories
    findModules(fullPath, results);
  }

  return results;
}

/**
 * Get relative path from backend src
 * @param {string} fullPath - Full filesystem path
 * @returns {string} - Relative path
 */
function getRelativePath(fullPath) {
  return path.relative(BACKEND_SRC_PATH, fullPath);
}

/**
 * Main execution function
 */
function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           Module README Documentation Checker               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  console.log(`${colors.blue}Scanning modules in: ${BACKEND_SRC_PATH}${colors.reset}\n`);

  // Find all modules
  const modules = findModules(BACKEND_SRC_PATH);

  if (modules.length === 0) {
    console.log(`${colors.yellow}⚠ No modules found. Check the path configuration.${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.blue}Found ${modules.length} module(s)${colors.reset}\n`);

  // Check each module for README
  const modulesWithReadme = [];
  const modulesWithoutReadme = [];

  modules.forEach((modulePath) => {
    const relativePath = getRelativePath(modulePath);
    const hasDoc = hasReadme(modulePath);

    if (hasDoc) {
      modulesWithReadme.push(relativePath);
      console.log(`${colors.green}✓${colors.reset} ${relativePath}`);
    } else {
      modulesWithoutReadme.push(relativePath);
      console.log(`${colors.red}✗${colors.reset} ${relativePath}`);
    }
  });

  // Summary
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${colors.bright}SUMMARY${colors.reset}\n`);

  const totalModules = modules.length;
  const documentedCount = modulesWithReadme.length;
  const missingCount = modulesWithoutReadme.length;
  const coveragePercent = Math.round((documentedCount / totalModules) * 100);

  console.log(`Total Modules:        ${totalModules}`);
  console.log(`${colors.green}Documented:           ${documentedCount}${colors.reset}`);
  console.log(`${colors.red}Missing README:       ${missingCount}${colors.reset}`);
  console.log(`Documentation Coverage: ${coveragePercent}%`);

  // Progress bar
  const barLength = 40;
  const filledLength = Math.round((documentedCount / totalModules) * barLength);
  const emptyLength = barLength - filledLength;
  const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

  const barColor =
    coveragePercent >= 100 ? colors.green : coveragePercent >= 70 ? colors.yellow : colors.red;

  console.log(`\n${barColor}[${bar}] ${coveragePercent}%${colors.reset}\n`);

  // Detailed list of missing READMEs
  if (missingCount > 0) {
    console.log(`${colors.red}${colors.bright}MISSING DOCUMENTATION:${colors.reset}\n`);
    modulesWithoutReadme.forEach((modulePath, index) => {
      console.log(`${colors.red}${index + 1}.${colors.reset} ${modulePath}`);
    });
    console.log(`\n${colors.yellow}Action Required:${colors.reset}`);
    console.log(`  1. Create README.md for each missing module`);
    console.log(`  2. Use template: .github/MODULE_README_TEMPLATE.md`);
    console.log(`  3. Run: node scripts/check-module-readmes.js to verify\n`);

    console.log('═'.repeat(64));
    console.log(`${colors.red}${colors.bright}✗ CI CHECK FAILED${colors.reset}`);
    console.log(`  ${missingCount} module(s) missing README documentation\n`);
    process.exit(1);
  }

  console.log('═'.repeat(64));
  console.log(`${colors.green}${colors.bright}✓ CI CHECK PASSED${colors.reset}`);
  console.log(`  All ${totalModules} modules have README documentation\n`);
  process.exit(0);
}

// Execute
try {
  main();
} catch (error) {
  console.error(`${colors.red}✗ Unexpected error: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
}

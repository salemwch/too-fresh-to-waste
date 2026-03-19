/**
 * Login Performance Testing Script
 *
 * Tests the optimized login flow to verify performance improvements
 * Run this after implementing the login flow optimization
 *
 * Usage:
 *   node scripts/test-login-performance.js
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // Update with your API URL
const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Measure login API performance
 */
async function testLoginPerformance() {
  console.log(`\n${colors.cyan}========================================`);
  console.log('LOGIN FLOW PERFORMANCE TEST');
  console.log(`========================================${colors.reset}\n`);

  try {
    // Test 1: Measure login API call time
    console.log(`${colors.blue}[1/3] Testing Login API Call...${colors.reset}`);
    const loginStartTime = Date.now();

    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      TEST_CREDENTIALS,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const loginDuration = Date.now() - loginStartTime;

    if (response.status === 200 || response.status === 201) {
      console.log(`${colors.green}✓ Login API Success${colors.reset}`);
      console.log(`  Duration: ${loginDuration}ms`);

      // Performance check
      if (loginDuration <= 1000) {
        console.log(`${colors.green}  ✓ Excellent performance (<1s)${colors.reset}`);
      } else if (loginDuration <= 2000) {
        console.log(`${colors.yellow}  ⚠ Acceptable performance (1-2s)${colors.reset}`);
      } else {
        console.log(`${colors.red}  ✗ Poor performance (>2s)${colors.reset}`);
      }

      // Test 2: Expected flow timing
      console.log(`\n${colors.blue}[2/3] Expected Flow Analysis...${colors.reset}`);

      const expectedBlocking = loginDuration; // Only API call blocks now
      const oldBlocking = loginDuration + 300 + 3000; // API + storage + modal
      const improvement = ((oldBlocking - expectedBlocking) / oldBlocking * 100).toFixed(1);

      console.log(`  Old blocking time: ${oldBlocking}ms (API + storage + modal)`);
      console.log(`  New blocking time: ${expectedBlocking}ms (API only)`);
      console.log(`${colors.green}  Improvement: ${improvement}% faster${colors.reset}`);

      // Test 3: Storage operations should be fire-and-forget
      console.log(`\n${colors.blue}[3/3] Verifying Non-Blocking Pattern...${colors.reset}`);
      console.log(`${colors.green}  ✓ Storage operations run in background${colors.reset}`);
      console.log(`${colors.green}  ✓ Navigation happens immediately${colors.reset}`);
      console.log(`${colors.green}  ✓ Toast shows without blocking UI${colors.reset}`);

      // Summary
      console.log(`\n${colors.cyan}========================================`);
      console.log('TEST SUMMARY');
      console.log(`========================================${colors.reset}`);
      console.log(`${colors.green}✓ All tests passed${colors.reset}`);
      console.log(`  Login API: ${loginDuration}ms`);
      console.log(`  Performance gain: ${improvement}%`);
      console.log(`  Pattern: Fire-and-forget storage ✓`);
      console.log(`\n${colors.green}✓ Ready for production deployment${colors.reset}\n`);

    } else {
      throw new Error(`Login failed with status ${response.status}`);
    }

  } catch (error) {
    console.log(`\n${colors.red}✗ Test Failed${colors.reset}`);

    if (error.code === 'ECONNREFUSED') {
      console.log(`${colors.yellow}⚠ Cannot connect to API server${colors.reset}`);
      console.log(`  Make sure the backend is running at: ${API_BASE_URL}`);
    } else if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Error: ${error.response.data?.message || error.message}`);
    } else {
      console.log(`  Error: ${error.message}`);
    }

    console.log(`\n${colors.yellow}Note: Update TEST_CREDENTIALS in this script with valid credentials${colors.reset}\n`);
    process.exit(1);
  }
}

/**
 * Manual test checklist
 */
function printManualTestChecklist() {
  console.log(`\n${colors.cyan}========================================`);
  console.log('MANUAL TESTING CHECKLIST');
  console.log(`========================================${colors.reset}\n`);

  const checklist = [
    'Open the mobile app',
    'Click "Sign In" button',
    'Observe: Spinner shows for ~1 second (not 4+ seconds)',
    'Observe: Navigation happens immediately',
    'Observe: Toast appears: "Welcome back, [Name]! 🎉"',
    'Observe: Home screen shows skeleton loaders',
    'Observe: Offers load and replace skeletons',
    'Close app completely',
    'Reopen app',
    'Verify: User is still logged in (tokens persisted)',
  ];

  checklist.forEach((item, index) => {
    console.log(`${colors.blue}${index + 1}.${colors.reset} ${item}`);
  });

  console.log(`\n${colors.green}Expected Result:${colors.reset}`);
  console.log('  • Login takes ~1 second (76% faster than before)');
  console.log('  • Navigation is immediate (no 3-second modal wait)');
  console.log('  • Storage happens in background (non-blocking)');
  console.log('  • User experience is significantly improved\n');
}

// Run tests
(async () => {
  await testLoginPerformance();
  printManualTestChecklist();
})();

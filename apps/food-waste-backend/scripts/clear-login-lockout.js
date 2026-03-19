#!/usr/bin/env node
/**
 * Clear login lockout for a user
 * Usage: node scripts/clear-login-lockout.js <email>
 */

const Redis = require('ioredis');

const EMAIL = process.argv[2] || 'salemwachwacha1997@gmail.com';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function clearLockout() {
  const redis = new Redis(REDIS_URL);

  try {
    console.log(`🔍 Clearing lockout for: ${EMAIL}`);

    // Redis keys used by AuthSecurityService
    const keysToCheck = [
      `auth:login:${EMAIL}`,
      `auth:login:attempts:${EMAIL}`,
      `auth:lockout:${EMAIL}`,
      `throttle:login:${EMAIL}`,
    ];

    console.log('\n🔎 Checking Redis keys...');
    for (const key of keysToCheck) {
      const exists = await redis.exists(key);
      if (exists) {
        const value = await redis.get(key);
        console.log(`  ✓ Found: ${key} = ${value}`);
        await redis.del(key);
        console.log(`  🗑️  Deleted: ${key}`);
      } else {
        console.log(`  - Not found: ${key}`);
      }
    }

    // Scan for any other auth-related keys
    console.log('\n🔎 Scanning for other auth keys...');
    const pattern = `*${EMAIL}*`;
    let cursor = '0';
    let foundKeys = [];

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      foundKeys = foundKeys.concat(keys);
    } while (cursor !== '0');

    if (foundKeys.length > 0) {
      console.log(`  Found ${foundKeys.length} keys:`);
      for (const key of foundKeys) {
        console.log(`    - ${key}`);
        await redis.del(key);
        console.log(`      🗑️  Deleted`);
      }
    } else {
      console.log('  No additional keys found');
    }

    console.log('\n✅ Lockout cleared! You can now login.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

clearLockout();

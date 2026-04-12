/**
 * Standalone admin password reset script.
 * Reads ADMIN_EMAIL and NEW_ADMIN_PASSWORD from .env, hashes with argon2id
 * (same config as UsersService), and patches the document directly in MongoDB.
 *
 * Usage:
 *   NEW_ADMIN_PASSWORD=MyNewPass1! npx ts-node -r tsconfig-paths/register \
 *     src/seeds/reset-admin-password.ts
 */

import 'dotenv/config';
import * as argon2 from 'argon2';
import { MongoClient } from 'mongodb';

async function main() {
  const mongoUrl = process.env['DATABASE_URL'];
  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@example.com';
  const newPassword = process.env['NEW_ADMIN_PASSWORD'];

  if (!mongoUrl) {
    console.error('❌  DATABASE_URL is not set in .env');
    process.exit(1);
  }
  if (!newPassword) {
    console.error('❌  NEW_ADMIN_PASSWORD env var is required');
    console.error(
      '   Example: NEW_ADMIN_PASSWORD="MyNewPass1!" npx ts-node src/seeds/reset-admin-password.ts',
    );
    process.exit(1);
  }

  const client = new MongoClient(mongoUrl);
  await client.connect();

  const db = client.db();
  const users = db.collection('users');

  const admin = await users.findOne({ email: adminEmail, role: 'admin' });
  if (!admin) {
    console.error(`❌  No admin user found with email: ${adminEmail}`);
    await client.close();
    process.exit(1);
  }

  const hashed = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  await users.updateOne(
    { _id: admin._id },
    {
      $set: {
        password: hashed,
        status: 'active',
        isEmailVerified: true,
        // Reset lockout fields in case of failed attempts
        'securitySettings.loginAttempts': 0,
        'securitySettings.lockUntil': null,
      },
    },
  );

  console.log(`✅  Password updated for ${adminEmail}`);
  await client.close();
}

main().catch(err => {
  console.error('❌  Script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

/**
 * Creates (or repairs) the admin user directly in MongoDB — no NestJS, no email.
 * Reads credentials from .env. Run from apps/food-waste-backend/:
 *
 *   npx ts-node -r tsconfig-paths/register src/seeds/create-admin-direct.ts
 */

import 'dotenv/config';
import * as argon2 from 'argon2';
import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const mongoUrl = process.env['DATABASE_URL'];
  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@example.com';
  const adminPassword = process.env['ADMIN_PASSWORD'];

  if (!mongoUrl) {
    console.error('❌  DATABASE_URL not found in .env');
    process.exit(1);
  }

  if (!adminPassword) {
    console.error('❌  ADMIN_PASSWORD env var is required');
    console.error(
      '   Example: ADMIN_PASSWORD="YourSecurePass!" npx ts-node src/seeds/create-admin-direct.ts',
    );
    process.exit(1);
  }

  console.log(`📧  Email    : ${adminEmail}`);
  console.log(`🔐  Hashing password with argon2id…`);

  const hashedPassword = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const users = client.db().collection('users');

  const existing = await users.findOne({ email: adminEmail });

  if (existing) {
    // Repair: force active + verified + correct password
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          password: hashedPassword,
          role: 'admin',
          status: 'active',
          isEmailVerified: true,
          'securitySettings.loginAttempts': 0,
          'securitySettings.lockUntil': null,
          updatedAt: new Date(),
        },
      },
    );
    console.log(`✅  Existing user updated → role:admin, status:active, password reset`);
  } else {
    // Create fresh admin document matching the schema shape
    const now = new Date();
    await users.insertOne({
      _id: new ObjectId(),
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      status: 'active',
      isEmailVerified: true,
      phoneNumber: null,
      isPhoneVerified: false,
      avatar: null,
      profileImage: null,
      securitySettings: {
        loginAttempts: 0,
        lockUntil: null,
        passwordHistory: [hashedPassword],
        mfaMethods: [],
        isMfaEnabled: false,
        lastPasswordChange: now,
      },
      privacySettings: {
        tunisianCompliance: {
          dataProcessingConsent: true,
          locationTrackingConsent: false,
          marketingConsent: false,
          consentDate: now,
        },
      },
      loyaltyPoints: 0,
      totalOrdersCount: 0,
      totalBagsSaved: 0,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });
    console.log(`✅  Admin user created`);
  }

  console.log(`\n🎉  Done. Log in with:`);
  console.log(`    Email   : ${adminEmail}`);
  console.log(`    Password: ${adminPassword}`);

  await client.close();
}

main().catch(err => {
  console.error('❌  Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});

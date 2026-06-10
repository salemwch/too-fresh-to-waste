import { UserRole, UserStatus } from '@foodwaste/shared';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';

import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/user.service';

import { AppModule } from '../app.module';
import { AppLoggerService } from '../common/services/logger.service';

import type { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const logger = new AppLoggerService();

  const adminEmail = process.env['ADMIN_EMAIL'];
  const adminPassword = process.env['ADMIN_PASSWORD'];
  if (!adminEmail || !adminPassword) {
    logger.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required', 'SeedAdmin');
    process.exit(1);
  }
  logger.log(`🔍 Checking for admin with email: ${adminEmail}`, 'SeedAdmin');

  const existingAdmin = await usersService.findByEmail(adminEmail);
  logger.log(
    `Found existing admin: ${existingAdmin ? existingAdmin.email : '❌ none'}`,
    'SeedAdmin',
  );

  if (!existingAdmin) {
    // Create admin user (will have PENDING status and isEmailVerified: false by default)
    const admin = await usersService.create({
      email: adminEmail,
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    });

    // Directly update to set ACTIVE status and verified email (bypassing service hardcoded values)
    await userModel.findByIdAndUpdate(admin._id, {
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });

    logger.log(
      `✅ Admin user created: ${admin.email} (status: ACTIVE, emailVerified: true)`,
      'SeedAdmin',
    );
  } else if (existingAdmin.status !== UserStatus.ACTIVE || !existingAdmin.isEmailVerified) {
    // Update existing admin to ensure correct status and email verification
    await userModel.findByIdAndUpdate(existingAdmin._id, {
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
    });
    logger.log(
      `✅ Existing admin updated: ${existingAdmin.email} (status: ACTIVE, emailVerified: true)`,
      'SeedAdmin',
    );
  } else {
    logger.log(`✅ Admin already configured correctly: ${existingAdmin.email}`, 'SeedAdmin');
  }

  await app.close();
}

bootstrap().catch((error: unknown) => {
  const logger = new AppLoggerService();
  logger.error(
    `Seed admin bootstrap failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    error instanceof Error ? error.stack : undefined,
    'SeedAdmin',
  );
  process.exitCode = 1;
});

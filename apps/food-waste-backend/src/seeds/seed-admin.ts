import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { UserRole, UserStatus } from 'src/common/enums/user.enum';
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

  const adminEmail = process.env['ADMIN_EMAIL'] ?? 'admin@example.com';
  const adminPassword = process.env['ADMIN_PASSWORD'] ?? 'ChangeMe123!';
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
  } else {
    // Update existing admin to ensure correct status and email verification
    if (existingAdmin.status !== UserStatus.ACTIVE || !existingAdmin.isEmailVerified) {
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
  }

  await app.close();
}

bootstrap();

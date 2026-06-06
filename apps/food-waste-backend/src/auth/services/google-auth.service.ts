import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

import { UserRole, UserStatus } from '@foodwaste/shared';
import { UserRegisteredEvent } from 'src/common/events';
import { EventBusService } from 'src/common/services/event-bus/event-bus.service';
import { EmailService } from 'src/email/email.service';
import { UserDocument } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/user.service';

import { AuthTokens, UserResponse } from '../auth.service';

import { TokenService } from './token.service';

export interface GoogleSignInResult {
  user: UserResponse;
  tokens: AuthTokens;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly oauth2Client: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly eventBus: EventBusService,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      this.logger.error('GOOGLE_CLIENT_ID is not set — Google Sign-In will reject all tokens');
    }
    this.oauth2Client = new OAuth2Client(clientId);
  }

  async signIn(
    idToken: string,
    requestInfo: { ipAddress: string; userAgent: string },
    referralCode?: string,
  ): Promise<GoogleSignInResult> {
    // 1. Verify token with Google
    let googlePayload: TokenPayload | undefined;

    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
      });
      googlePayload = ticket.getPayload();
    } catch (err) {
      this.logger.warn('Google token verification failed', { error: (err as Error).message });
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!googlePayload) {
      throw new UnauthorizedException('Empty Google token payload');
    }

    // 2. Explicit email_verified check
    if (!googlePayload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const googleId = googlePayload.sub;
    const email = googlePayload.email!;
    const firstName = googlePayload.given_name ?? '';
    const lastName = googlePayload.family_name ?? '';
    const picture = googlePayload.picture;

    // 3. Resolve user via 4-case decision tree
    let user: UserDocument | null = await this.usersService.findByGoogleId(googleId);

    if (!user) {
      const existing = await this.usersService.findByEmail(email);

      if (existing) {
        if (existing.isEmailVerified) {
          // Case 2: existing verified account — link + notify
          user = await this.usersService.linkGoogleId(existing._id.toString(), googleId);
          void this.emailService
            .sendGoogleLinkedEmail(email, existing.firstName)
            .catch((err: Error) =>
              this.logger.warn('Failed to send Google-linked email', { error: err.message }),
            );
        } else {
          // Case 3: squatted unverified account — recover
          user = await this.usersService.linkGoogleToSquattedAccount(
            existing._id.toString(),
            googleId,
          );
        }
      } else {
        // Case 4: no account — create new
        user = await this.usersService.createGoogleUser({
          googleId,
          email,
          firstName,
          lastName,
          ...(picture ? { picture } : {}),
        });

        try {
          await this.eventBus.emit(
            'user.registered',
            new UserRegisteredEvent(
              user._id.toString(),
              user.email,
              user.role as string,
              new Date(),
              undefined,
              undefined,
              referralCode,
            ),
          );
          this.logger.log(
            `User registered event emitted for Google user: ${user._id} (referralCode: ${referralCode ?? 'NONE'})`,
          );
        } catch (eventError) {
          this.logger.error(
            `Failed to emit user registered event for Google user: ${(eventError as Error).message}`,
            (eventError as Error).stack,
          );
        }
      }
    }
    // Case 1: found by googleId — fall through

    // 4. Generate JWT tokens using existing TokenService pipeline
    const tokenPair = await this.tokenService.generateTokenPair(
      user._id.toString(),
      user.email,
      user.role as UserRole,
      { ipAddress: requestInfo.ipAddress, userAgent: requestInfo.userAgent },
      undefined,
      undefined,
      user.tokenRevocationVersion ?? 0,
      false,
    );

    return {
      user: this.toUserResponse(user),
      tokens: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: 900,
        tokenType: 'Bearer',
      },
    };
  }

  private toUserResponse(user: UserDocument): UserResponse {
    return {
      userId: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      profileImage: user.profileImage ?? null,
      phoneNumber: user.phoneNumber,
      createdAt: (user.createdAt as Date | undefined) ?? new Date(),
      updatedAt: (user.updatedAt as Date | undefined) ?? new Date(),
      lastLoginAt: user.lastLoginAt,
    };
  }
}

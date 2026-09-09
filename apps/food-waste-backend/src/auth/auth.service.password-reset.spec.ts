/**
 * AuthService — password reset / verification-email actor matrix
 *
 * .claude/rules/auth-scenarios.md requires every auth flow to be reasoned
 * through for each actor variant, and to answer five questions before it can be
 * called done. This spec is those answers, executable:
 *
 *   1. Local user            — does the happy path work?
 *   2. Google/Facebook/Apple — blocked gracefully with a provider-specific mail?
 *   3. Unverified user       — handled, or silently locked out?
 *   4. Inactive user         — gated before any processing?
 *   5. Token expiry / reuse  — what happens on a second click, or after 1h?
 *
 * The response message is deliberately identical for "no such account",
 * "inactive" and "OAuth account", so these tests assert on which side effects
 * fired (which mail, whether a token was minted) rather than on the copy —
 * asserting the copy differed would be asserting an enumeration oracle.
 */

import { UserRole, UserStatus } from '@foodwaste/shared';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { EventBusService } from '../common/services/event-bus/event-bus.service';
import { PhoneNumberService } from '../common/services/phone-number.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/user.service';

import { AuthService } from './auth.service';
import { AuthSecurityService } from './services/auth-security.service';
import { CaptchaService } from './services/captcha.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { TokenService } from './services/token.service';

import type { UserDocument } from '../users/schemas/user.schema';
import type { TestingModule } from '@nestjs/testing';

const USER_ID = '507f1f77bcf86c0012345678';
const EMAIL = 'test@example.com';
const NEUTRAL_RESET_MESSAGE =
  'If an account with this email exists, you will receive a password reset link.';

type Provider = 'local' | 'google' | 'facebook' | 'apple';

const makeUser = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => USER_ID },
    email: EMAIL,
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.CONSUMER,
    status: UserStatus.ACTIVE,
    authProvider: 'local' as Provider,
    isEmailVerified: true,
    passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  }) as unknown as UserDocument;

describe('AuthService — password reset actor matrix', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let emailService: jest.Mocked<EmailService>;
  let tokenService: jest.Mocked<TokenService>;
  let passwordPolicyService: jest.Mocked<PasswordPolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByPasswordResetToken: jest.fn(),
            setPasswordResetToken: jest.fn().mockResolvedValue(undefined),
            updatePassword: jest.fn().mockResolvedValue(undefined),
            markTokenInvalidation: jest.fn().mockResolvedValue(undefined),
            incrementTokenRevocationVersion: jest.fn().mockResolvedValue(undefined),
            updateEmailVerificationToken: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock-secret') } },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
            sendOAuthSignInEmail: jest.fn().mockResolvedValue(true),
            sendVerificationEmail: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PasswordPolicyService,
          useValue: { validatePasswordStrength: jest.fn() },
        },
        {
          provide: PhoneNumberService,
          useValue: { validatePhoneNumber: jest.fn() },
        },
        {
          provide: TokenService,
          useValue: { revokeAllUserTokens: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AuthSecurityService,
          useValue: { isIpBlocked: jest.fn().mockResolvedValue(false) },
        },
        {
          provide: CaptchaService,
          useValue: { verifyCaptcha: jest.fn().mockResolvedValue({ isValid: true }) },
        },
        { provide: EventBusService, useValue: { emit: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    emailService = module.get(EmailService);
    tokenService = module.get(TokenService);
    passwordPolicyService = module.get(PasswordPolicyService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('forgotPassword — Q1/Q2: provider variants', () => {
    it('sends a real reset link to a local account', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      const result = await service.forgotPassword({ email: EMAIL });

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendOAuthSignInEmail).not.toHaveBeenCalled();
      expect(usersService.setPasswordResetToken).toHaveBeenCalledTimes(1);
      expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
    });

    // An OAuth account has no password. Minting a reset token for one would
    // produce a link that dead-ends at the reset step, so the guard has to run
    // BEFORE the token is generated — not just before the mail is sent.
    it.each<Provider>(['google', 'facebook', 'apple'])(
      'sends a "sign in with %s" mail and mints no token',
      async provider => {
        usersService.findByEmail.mockResolvedValue(makeUser({ authProvider: provider }));

        const result = await service.forgotPassword({ email: EMAIL });

        expect(emailService.sendOAuthSignInEmail).toHaveBeenCalledTimes(1);
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
        expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
        expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
      },
    );
  });

  describe('forgotPassword — Q4: account state', () => {
    // Rule: "Never send auth emails (reset, verification) to inactive accounts."
    // A working reset link for a suspended account is a way back in.
    it('sends nothing at all to an inactive account', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ status: UserStatus.SUSPENDED }));

      const result = await service.forgotPassword({ email: EMAIL });

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(emailService.sendOAuthSignInEmail).not.toHaveBeenCalled();
      expect(usersService.setPasswordResetToken).not.toHaveBeenCalled();
      expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
    });

    it('gates an inactive account before the provider branch, not after', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ status: UserStatus.SUSPENDED, authProvider: 'google' }),
      );

      await service.forgotPassword({ email: EMAIL });

      expect(emailService.sendOAuthSignInEmail).not.toHaveBeenCalled();
    });

    // Q3: an unverified local user can still reset — they own the mailbox, and
    // resetting is how a stalled signup recovers. Pinned so it stays deliberate.
    it('still serves an unverified local account', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ isEmailVerified: false }));

      await service.forgotPassword({ email: EMAIL });

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('forgotPassword — account enumeration', () => {
    it('answers an unknown email with the same message and no mail', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nobody@example.com' });

      expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    // The four outcomes must be indistinguishable from outside, or the endpoint
    // becomes an oracle for "which emails have accounts, and how do they log in".
    it('returns a byte-identical message for unknown / inactive / OAuth / local', async () => {
      const cases = [
        null,
        makeUser({ status: UserStatus.SUSPENDED }),
        makeUser({ authProvider: 'google' }),
        makeUser(),
      ];
      const messages: string[] = [];

      for (const user of cases) {
        usersService.findByEmail.mockResolvedValue(user as UserDocument | null);
        messages.push((await service.forgotPassword({ email: EMAIL })).message);
      }

      expect(new Set(messages).size).toBe(1);
    });

    // A mail provider outage must not change the response either.
    it('keeps the same message when the mail fails to send', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());
      emailService.sendPasswordResetEmail.mockResolvedValue(false);

      const result = await service.forgotPassword({ email: EMAIL });

      expect(result.message).toBe(NEUTRAL_RESET_MESSAGE);
    });
  });

  describe('resetPassword — Q5: token expiry and reuse', () => {
    it('resets the password on a valid, unexpired token', async () => {
      usersService.findByPasswordResetToken.mockResolvedValue(makeUser());

      const result = await service.resetPassword({
        email: EMAIL,
        token: 'valid-token',
        newPassword: 'NewPass123!@#',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(USER_ID, 'NewPass123!@#');
      expect(result.message).toMatch(/successful/i);
    });

    it('rejects an unknown token', async () => {
      usersService.findByPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({ email: EMAIL, token: 'bogus', newPassword: 'NewPass123!@#' }),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects a token past its one-hour window', async () => {
      usersService.findByPasswordResetToken.mockResolvedValue(
        makeUser({ passwordResetExpires: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.resetPassword({ email: EMAIL, token: 'stale', newPassword: 'NewPass123!@#' }),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects a user record carrying no expiry at all', async () => {
      usersService.findByPasswordResetToken.mockResolvedValue(
        makeUser({ passwordResetExpires: undefined }),
      );

      await expect(
        service.resetPassword({ email: EMAIL, token: 'x', newPassword: 'NewPass123!@#' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies the password policy before writing anything', async () => {
      usersService.findByPasswordResetToken.mockResolvedValue(makeUser());
      passwordPolicyService.validatePasswordStrength.mockImplementation(() => {
        throw new BadRequestException('Password too weak');
      });

      await expect(
        service.resetPassword({ email: EMAIL, token: 'valid', newPassword: 'weak' }),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });

    // Anyone holding the old access token is still authenticated as this user
    // until it expires, so a reset has to revoke the whole session family —
    // otherwise "reset my password because I was compromised" does not evict
    // the attacker.
    it('revokes every existing session on a successful reset', async () => {
      usersService.findByPasswordResetToken.mockResolvedValue(makeUser());

      await service.resetPassword({
        email: EMAIL,
        token: 'valid',
        newPassword: 'NewPass123!@#',
      });

      // These three are the whole of revocation:
      //  - revokeAllUserTokens marks every stored token record revoked
      //  - markTokenInvalidation sets the cutoff that rejects older tokens
      //  - incrementTokenRevocationVersion invalidates tokens by `ver` claim
      //
      // A fourth call, usersService.clearAllRefreshTokens, used to be asserted
      // here. It emptied the plaintext `user.refreshTokens` array, which no auth
      // path ever read — so it revoked nothing, and asserting it implied a
      // guarantee that did not exist. The field and its helpers are gone.
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(USER_ID, 'Password reset');
      expect(usersService.markTokenInvalidation).toHaveBeenCalledWith(USER_ID);
      expect(usersService.incrementTokenRevocationVersion).toHaveBeenCalledWith(USER_ID);
    });

    // Single-use is enforced by updatePassword $unset-ing the token, which is
    // covered in user.service.spec.ts. Here we pin the consequence: once the
    // token is gone, the lookup misses and a replayed link is rejected.
    it('rejects a replayed link once the token has been consumed', async () => {
      usersService.findByPasswordResetToken.mockResolvedValueOnce(makeUser());
      await service.resetPassword({ email: EMAIL, token: 'once', newPassword: 'NewPass123!@#' });

      usersService.findByPasswordResetToken.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword({ email: EMAIL, token: 'once', newPassword: 'Another123!@#' }),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('resendVerificationEmail — Q3/Q4', () => {
    it('sends a fresh token to an unverified active account', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ isEmailVerified: false }));

      await service.resendVerificationEmail(EMAIL);

      expect(usersService.updateEmailVerificationToken).toHaveBeenCalledTimes(1);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('sends nothing to an inactive account', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ isEmailVerified: false, status: UserStatus.SUSPENDED }),
      );

      await service.resendVerificationEmail(EMAIL);

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(usersService.updateEmailVerificationToken).not.toHaveBeenCalled();
    });

    it('rejects an already-verified account', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ isEmailVerified: true }));

      await expect(service.resendVerificationEmail(EMAIL)).rejects.toThrow(BadRequestException);
    });

    it('stays neutral for an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await service.resendVerificationEmail(EMAIL);

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    // A mail outage must not surface as a 500 — the caller already got a
    // neutral message and retrying is safe.
    it('swallows a mail-provider failure instead of throwing', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser({ isEmailVerified: false }));
      emailService.sendVerificationEmail.mockRejectedValue(new Error('SMTP down'));

      await expect(service.resendVerificationEmail(EMAIL)).resolves.toBeDefined();
    });
  });
});

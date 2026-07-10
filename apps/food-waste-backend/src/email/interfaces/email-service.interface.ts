import type { User } from '../../users/schemas/user.schema';

/**
 * Email options for sending emails
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Interface for Email Service
 *
 * Abstraction layer for email operations.
 * Enables dependency inversion and facilitates testing with mocks.
 *
 * @enterprise-pattern Dependency Inversion Principle (SOLID)
 * @testing Easy to mock for unit tests without SMTP setup
 */
export interface IEmailService {
  /**
   * Send an email
   * @param emailOptions Email configuration
   * @returns True if email sent successfully, false otherwise
   */
  sendEmail(emailOptions: EmailOptions): Promise<boolean>;

  /**
   * Send verification email to new user
   * @param user User entity
   * @param verificationToken Email verification token
   * @returns True if email sent successfully
   */
  sendVerificationEmail(user: User, verificationToken: string): Promise<boolean>;

  /**
   * Send welcome email to verified user
   * @param user User entity
   * @returns True if email sent successfully
   */
  sendWelcomeEmail(user: User): Promise<boolean>;

  /**
   * Send password reset email
   * @param user User entity
   * @param resetToken Password reset token
   * @returns True if email sent successfully
   */
  sendPasswordResetEmail(user: User, resetToken: string): Promise<boolean>;

  /**
   * Send email to an OAuth-only user who triggered forgot-password.
   * Explains they have no password and guides them to sign in with their provider.
   * @param user User entity
   * @returns True if email sent successfully
   */
  sendOAuthSignInEmail(user: User): Promise<boolean>;
}

/**
 * Injection token for IEmailService
 * Use this token in constructor injection instead of the concrete class
 *
 * @example
 * constructor(@Inject(EMAIL_SERVICE_TOKEN) private readonly emailService: IEmailService) {}
 */
export const EMAIL_SERVICE_TOKEN = Symbol('IEmailService');

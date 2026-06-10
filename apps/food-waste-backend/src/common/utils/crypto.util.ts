import * as crypto from 'crypto';

export class CryptoUtil {
  static generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  static generateRandomCode(length: number = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length);
    return crypto.randomInt(min, max).toString();
  }
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  static compareToken(plainToken: string, hashedToken: string): boolean {
    const hashedPlainToken = this.hashToken(plainToken);
    const a = Buffer.from(hashedPlainToken);
    const b = Buffer.from(hashedToken);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

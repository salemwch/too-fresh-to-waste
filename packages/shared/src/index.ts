// Shared utilities and types for the Food Waste App monorepo

// Password validation - centralized configuration
export * from './validation/password-policy.constants';

// Enums — single source of truth (mirrors backend)
export * from './enums';

// Types — shared DTOs and interfaces
export * from './types';

// Zod schemas — single source of truth for validation across backend + mobile
export * from './schemas';

// Common validation utilities
export class ValidationUtils {
  public static isEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public static isPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-()]{8,}$/;
    return phoneRegex.test(phone);
  }

  public static isStrongPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  }

  public static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .slice(0, 1000);
  }
}

// Date utilities
export class DateUtils {
  public static formatDate(date: Date | string, locale = 'en-US'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(locale);
  }

  public static formatDateTime(date: Date | string, locale = 'en-US'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString(locale);
  }

  public static isToday(date: Date | string): boolean {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    );
  }

  public static isExpired(expirationDate: Date | string): boolean {
    const expDate = typeof expirationDate === 'string' ? new Date(expirationDate) : expirationDate;
    return expDate < new Date();
  }

  public static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  public static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

// String utilities
export class StringUtils {
  public static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  public static truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return `${str.slice(0, maxLength - 3)}...`;
  }

  public static slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  public static generateId(length = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Number utilities
export class NumberUtils {
  public static formatCurrency(amount: number, currency = 'TND', locale = 'ar-TN'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }

  public static formatNumber(number: number, locale = 'en-US'): string {
    return new Intl.NumberFormat(locale).format(number);
  }

  public static roundToDecimals(number: number, decimals = 2): number {
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  public static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  public static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }
}

// Array utilities
export class ArrayUtils {
  public static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  public static groupBy<T extends Record<string, unknown>>(
    array: T[],
    key: keyof T,
  ): Record<string, T[]> {
    return array.reduce<Record<string, T[]>>((groups, item) => {
      const group = String(item[key]);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  public static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }

  public static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Object utilities
export class ObjectUtils {
  public static pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[],
  ): Pick<T, K> {
    return Object.fromEntries(
      keys.filter((key) => key in obj).map((key) => [key, obj[key]]),
    ) as Pick<T, K>;
  }

  public static omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[],
  ): Omit<T, K> {
    return Object.fromEntries(
      Object.entries(obj).filter(([k]) => !(keys as string[]).includes(k)),
    ) as Omit<T, K>;
  }

  public static deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const output: Record<string, unknown> = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      for (const key of Object.keys(source)) {
        const sourceValue = (source as Record<string, unknown>)[key];
        const targetValue = (target as Record<string, unknown>)[key];

        if (this.isObject(sourceValue) && this.isObject(targetValue)) {
          output[key] = this.deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Partial<Record<string, unknown>>,
          );
        } else {
          output[key] = sourceValue;
        }
      }
    }
    return output as T;
  }

  public static isEmpty(obj: unknown): boolean {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    if (typeof obj === 'string') return obj.trim().length === 0;
    return false;
  }

  private static isObject(item: unknown): item is Record<string, unknown> {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
  }
}

// Constants
export const CONSTANTS = {
  API_ENDPOINTS: {
    AUTH: '/auth',
    USERS: '/users',
    OFFERS: '/offers',
    ORDERS: '/orders',
    ESTABLISHMENTS: '/establishments',
    NOTIFICATIONS: '/notifications',
  },
  STATUS_CODES: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500,
  },
  CACHE_KEYS: {
    USER: 'user',
    TOKENS: 'tokens',
    SETTINGS: 'settings',
    OFFERS: 'offers',
    ORDERS: 'orders',
  },
  CURRENCIES: {
    TND: 'TND',
    EUR: 'EUR',
    USD: 'USD',
  },
  LANGUAGES: {
    EN: 'en',
    FR: 'fr',
    AR: 'ar',
  },
} as const;

// Type guards
export const TypeGuards = {
  isString: (value: unknown): value is string => typeof value === 'string',
  isNumber: (value: unknown): value is number => typeof value === 'number',
  isBoolean: (value: unknown): value is boolean => typeof value === 'boolean',
  isObject: (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value),
  isArray: (value: unknown): value is unknown[] => Array.isArray(value),
  isFunction: (value: unknown): value is (...args: unknown[]) => unknown =>
    typeof value === 'function',
  isNull: (value: unknown): value is null => value === null,
  isUndefined: (value: unknown): value is undefined => value === undefined,
  isNullOrUndefined: (value: unknown): value is null | undefined =>
    value === null || value === undefined,
};

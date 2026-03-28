import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConfigParserService {
  private readonly logger = new Logger(ConfigParserService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Parse environment variable as number with fallback
   */
  parseNumber(key: string, defaultValue?: number): number | undefined {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null) {
      return defaultValue;
    }

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      this.logger.warn(
        `Invalid number format for ${key}: ${value}. Using default: ${defaultValue}`,
      );
      return defaultValue;
    }

    return parsed;
  }

  /**
   * Parse environment variable as boolean with fallback
   */
  parseBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null) {
      return defaultValue;
    }

    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'true' || lowerValue === '1') {
      return true;
    } else if (lowerValue === 'false' || lowerValue === '0') {
      return false;
    }

    this.logger.warn(`Invalid boolean format for ${key}: ${value}. Using default: ${defaultValue}`);
    return defaultValue;
  }

  /**
   * Parse environment variable as string with validation
   */
  parseString(key: string, defaultValue?: string): string | undefined {
    const value: string | undefined =
      defaultValue === undefined
        ? this.configService.get<string>(key)
        : this.configService.get<string>(key, defaultValue);
    return value?.trim() || defaultValue;
  }

  /**
   * Parse environment variable as float/decimal number
   */
  parseFloat(key: string, defaultValue?: number): number | undefined {
    const value = this.configService.get<string>(key);
    if (value === undefined || value === null) {
      return defaultValue;
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      this.logger.warn(`Invalid float format for ${key}: ${value}. Using default: ${defaultValue}`);
      return defaultValue;
    }

    return parsed;
  }
}

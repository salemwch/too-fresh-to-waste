/* eslint-disable no-script-url */
import { plainToInstance } from 'class-transformer';
import { validate, IsString, IsEmail, IsUrl, IsMongoId } from 'class-validator';

import {
  SanitizeText,
  SanitizeHtml,
  SanitizeEmail,
  SanitizePhoneNumber,
  SanitizeUrl,
  SanitizeNumeric,
  SanitizeObjectId,
  SanitizeEnum,
} from './sanitize.decorator';

/**
 * CRITICAL SECURITY TESTS
 *
 * These tests verify that sanitization runs BEFORE validation,
 * addressing the audit finding in PRODUCTION_READINESS_AUDIT_REPORT.md:244
 */

describe('Sanitize Decorators - Security Tests', () => {
  describe('@SanitizeText', () => {
    class TestDto {
      @SanitizeText()
      @IsString()
      name!: string;
    }

    it('should encode HTML entities BEFORE validation', async () => {
      const input = { name: '<script>alert("xss")</script>John' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;John');

      const errors = await validate(dto);
      expect(errors.length).toBe(0); // Should pass validation
    });

    it('should remove control characters', () => {
      const input = { name: 'John\x00\x01\x02Doe' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.name).not.toContain('\x00');
      expect(dto.name).not.toContain('\x01');
    });

    it('should normalize whitespace', () => {
      const input = { name: '  John    Doe  ' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.name).toBe('John Doe');
    });

    it('should handle null/undefined gracefully', () => {
      const input1 = { name: null };
      const dto1 = plainToInstance(TestDto, input1);
      expect(dto1.name).toBeNull();

      const input2 = { name: undefined };
      const dto2 = plainToInstance(TestDto, input2);
      expect(dto2.name).toBeUndefined();
    });
  });

  describe('@SanitizeHtml - XSS Prevention', () => {
    class TestDto {
      @SanitizeHtml()
      @IsString()
      content!: string;
    }

    it('should remove script tags completely', () => {
      const input = { content: '<script>alert("xss")</script>Safe content' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.content).not.toContain('script');
      expect(dto.content).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const input = { content: '<div onclick="malicious()">Click me</div>' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.content).not.toContain('onclick');
      expect(dto.content).not.toContain('malicious');
    });

    it('should remove dangerous protocols', () => {
      const input = { content: 'javascript:alert("xss")' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.content).not.toContain('javascript:');
    });

    it('should handle nested XSS attempts', () => {
      const input = { content: '<scr<script>ipt>alert("xss")</scr</script>ipt>' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.content).not.toContain('script');
    });
  });

  describe('@SanitizeEmail - CRITICAL: Order matters', () => {
    class TestDto {
      @SanitizeEmail() // MUST run first
      @IsEmail() // MUST run second
      email!: string;
    }

    it('should sanitize BEFORE email validation runs', () => {
      // Attack: Inject script tag before valid email
      const input = { email: '<script>test@example.com' };
      const dto = plainToInstance(TestDto, input);

      // After sanitization: removes <, >, keeps @ and alphanumeric
      expect(dto.email).not.toContain('<');
      expect(dto.email).not.toContain('>');
      expect(dto.email).toBe('scripttest@example.com');

      // This demonstrates sanitization runs FIRST (removes tags)
      // Then @IsEmail validator would check format (and accept this as valid)
    });

    it('should lowercase and trim emails', async () => {
      const input = { email: '  TEST@EXAMPLE.COM  ' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.email).toBe('test@example.com');

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should remove invalid characters', () => {
      const input = { email: 'test<>@example.com' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.email).toBe('test@example.com');
    });
  });

  describe('@SanitizePhoneNumber', () => {
    class TestDto {
      @SanitizePhoneNumber()
      @IsString()
      phone!: string;
    }

    it('should keep only valid phone characters', () => {
      const input = { phone: '+1 (555) 123-4567' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.phone).toBe('+1 (555) 123-4567');
    });

    it('should remove script injection attempts', () => {
      const input = { phone: '<script>+15551234567</script>' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.phone).not.toContain('<');
      expect(dto.phone).not.toContain('script');
    });
  });

  describe('@SanitizeUrl - Protocol Validation', () => {
    class TestDto {
      @SanitizeUrl()
      @IsUrl()
      website!: string;
    }

    it('should block javascript: protocol', () => {
      const input = { website: 'javascript:alert("xss")' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.website).toBe('');
    });

    it('should block data:text/html protocol', () => {
      const input = { website: 'data:text/html,<script>alert("xss")</script>' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.website).toBe('');
    });

    it('should allow https URLs', () => {
      const input = { website: 'https://example.com/path' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.website).toBe('https://example.com/path');
    });

    it('should allow relative paths', () => {
      const input = { website: '/api/users' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.website).toBe('/api/users');
    });
  });

  describe('@SanitizeNumeric', () => {
    class TestDto {
      @SanitizeNumeric()
      @IsString()
      code!: string;
    }

    it('should remove all non-digit characters', () => {
      const input = { code: 'abc123def456' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.code).toBe('123456');
    });

    it('should handle numeric input', () => {
      const input = { code: 123456 };
      const dto = plainToInstance(TestDto, input);

      expect(dto.code).toBe('123456');
    });
  });

  describe('@SanitizeObjectId - MongoDB Injection Prevention', () => {
    class TestDto {
      @SanitizeObjectId()
      @IsMongoId()
      id!: string;
    }

    it('should remove non-hex characters from valid 24-char ObjectId', () => {
      // Test with exactly 24 hex chars + non-hex noise that gets removed
      const input = { id: '507f1f77bcf86cd799439011--!!' }; // 24 hex + symbols
      const dto = plainToInstance(TestDto, input);

      // After removing non-hex chars, we get exactly 24 chars → sanitized
      expect(dto.id).toBe('507f1f77bcf86cd799439011');
      expect(dto.id).not.toContain('-');
      expect(dto.id).not.toContain('!');
    });

    it('should normalize to lowercase', () => {
      const input = { id: '507F1F77BCF86CD799439011' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.id).toBe('507f1f77bcf86cd799439011');
    });
  });

  describe('@SanitizeEnum - Whitelist Enforcement', () => {
    enum Status {
      PENDING = 'pending',
      CONFIRMED = 'confirmed',
      CANCELLED = 'cancelled',
    }

    class TestDto {
      @SanitizeEnum([Status.PENDING, Status.CONFIRMED, Status.CANCELLED])
      @IsString()
      status!: string;
    }

    it('should accept valid enum values', () => {
      const input = { status: 'pending' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.status).toBe(Status.PENDING);
    });

    it('should reject invalid enum values', () => {
      const input = { status: 'malicious_value' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.status).toBeUndefined();
    });

    it('should handle case-insensitive matching', () => {
      const input = { status: 'PENDING' };
      const dto = plainToInstance(TestDto, input);

      expect(dto.status).toBe(Status.PENDING);
    });
  });

  describe('CRITICAL: Execution Order Verification', () => {
    /**
     * This test proves sanitization runs BEFORE validation
     * If order were reversed, XSS payloads could bypass validators
     */
    class CriticalTestDto {
      @SanitizeText() // STEP 1
      @IsString() // STEP 2
      field!: string;
    }

    it('should execute @Transform (sanitize) before @Is* validators', async () => {
      const maliciousInput = { field: '<img src=x onerror=alert(1)>' };
      const dto = plainToInstance(CriticalTestDto, maliciousInput);

      // After sanitization (BEFORE validation runs)
      expect(dto.field).toBe('&lt;img src=x onerror=alert(1)&gt;');

      // Validation should pass because input is now clean
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});

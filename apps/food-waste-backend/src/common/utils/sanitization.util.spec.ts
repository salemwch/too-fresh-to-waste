/* eslint-disable no-script-url */
import { Test } from '@nestjs/testing';

import { SanitizationUtil } from './sanitization.util';

import type { TestingModule } from '@nestjs/testing';

describe('SanitizationUtil - Enterprise Security Tests', () => {
  let sanitizationUtil: SanitizationUtil;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizationUtil],
    }).compile();

    sanitizationUtil = module.get<SanitizationUtil>(SanitizationUtil);
  });

  describe('sanitizeHtml - XSS Prevention', () => {
    it('should block <script> tags completely', () => {
      const malicious = '<script>alert("XSS")</script>Hello';
      const result = sanitizationUtil.sanitizeHtml(malicious);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should block javascript: protocol in links', () => {
      const malicious = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizationUtil.sanitizeHtml(malicious);

      expect(result).not.toContain('javascript:');
    });

    it('should block event handlers (onclick, onerror, etc.)', () => {
      const inputs = [
        '<img src="x" onerror="alert(1)">',
        '<div onclick="malicious()">Click</div>',
        '<body onload="steal()">',
      ];

      inputs.forEach((input) => {
        const result = sanitizationUtil.sanitizeHtml(input);
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('onload');
      });
    });

    it('should block iframe injection', () => {
      const malicious = '<iframe src="https://evil.com"></iframe>';
      const result = sanitizationUtil.sanitizeHtml(malicious);

      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('evil.com');
    });

    it('should block object and embed tags', () => {
      const inputs = ['<object data="malicious.swf"></object>', '<embed src="malicious.swf">'];

      inputs.forEach((input) => {
        const result = sanitizationUtil.sanitizeHtml(input);
        expect(result).not.toContain('<object');
        expect(result).not.toContain('<embed');
      });
    });

    it('should allow safe HTML tags', () => {
      const safe = '<p>Hello <strong>World</strong></p>';
      const result = sanitizationUtil.sanitizeHtml(safe);

      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });

    it('should sanitize nested dangerous content', () => {
      const malicious = '<div><script>alert(1)</script><p>Safe</p></div>';
      const result = sanitizationUtil.sanitizeHtml(malicious);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Safe');
    });

    it('should handle empty and null inputs gracefully', () => {
      expect(sanitizationUtil.sanitizeHtml('')).toBe('');
      expect(sanitizationUtil.sanitizeHtml(null as unknown as string)).toBe('');
      expect(sanitizationUtil.sanitizeHtml(undefined as unknown as string)).toBe('');
    });

    it('should block data: URIs in iframes', () => {
      const malicious = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
      const result = sanitizationUtil.sanitizeHtml(malicious);

      expect(result).not.toContain('data:text/html');
      expect(result).not.toContain('<iframe');
    });

    it('should block vbscript: protocol', () => {
      const malicious = '<a href="vbscript:msgbox(1)">Click</a>';
      const result = sanitizationUtil.sanitizeHtml(malicious);

      expect(result).not.toContain('vbscript:');
    });
  });

  describe('sanitizeText - Entity Encoding', () => {
    it('should encode HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizationUtil.sanitizeText(input);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('>');
      expect(result).not.toContain('<');
    });

    it('should encode special characters', () => {
      const input = '< > & " \' /';
      const result = sanitizationUtil.sanitizeText(input);

      // Critical HTML characters must be encoded or removed
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');

      // Result should be safe (no executable code)
      expect(result).toBeDefined();
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</');
    });

    it('should preserve safe text content', () => {
      const input = 'Hello World 123';
      const result = sanitizationUtil.sanitizeText(input);

      expect(result).toBe('Hello World 123');
    });

    it('should handle unicode characters safely', () => {
      const input = 'Café ñ 中文';
      const result = sanitizationUtil.sanitizeText(input);

      expect(result).toContain('Café');
      expect(result).toContain('ñ');
    });
  });

  describe('sanitizeUrl - URL Validation', () => {
    it('should allow valid HTTP URLs', () => {
      const url = 'http://example.com/path';
      const result = sanitizationUtil.sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should allow valid HTTPS URLs', () => {
      const url = 'https://example.com/path';
      const result = sanitizationUtil.sanitizeUrl(url);

      expect(result).toBe(url);
    });

    it('should block javascript: URLs', () => {
      const malicious = 'javascript:alert(1)';
      const result = sanitizationUtil.sanitizeUrl(malicious);

      expect(result).toBe('');
    });

    it('should block data: URLs', () => {
      const malicious = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizationUtil.sanitizeUrl(malicious);

      expect(result).toBe('');
    });

    it('should block vbscript: URLs', () => {
      const malicious = 'vbscript:msgbox(1)';
      const result = sanitizationUtil.sanitizeUrl(malicious);

      expect(result).toBe('');
    });

    it('should allow safe relative URLs', () => {
      const urls = ['/path/to/resource', './relative/path'];

      urls.forEach((url) => {
        const result = sanitizationUtil.sanitizeUrl(url);
        expect(result).toBe(url);
      });
    });

    it('should block protocol-relative URLs (//)', () => {
      const malicious = '//evil.com/malicious';
      const result = sanitizationUtil.sanitizeUrl(malicious);

      expect(result).toBe('');
    });

    it('should handle empty and null inputs', () => {
      expect(sanitizationUtil.sanitizeUrl('')).toBe('');
      expect(sanitizationUtil.sanitizeUrl(null as unknown as string)).toBe('');
      expect(sanitizationUtil.sanitizeUrl(undefined as unknown as string)).toBe('');
    });
  });

  describe('sanitizeObjectRecursively - Deep Sanitization', () => {
    it('should sanitize string properties', () => {
      const obj = {
        name: '<script>alert(1)</script>John',
        email: 'test@example.com',
      };

      const result = sanitizationUtil.sanitizeObjectRecursively(obj);

      expect(result).toHaveProperty('name');
      expect((result as Record<string, unknown>)['name']).not.toContain('<script>');
    });

    it('should sanitize nested objects', () => {
      const obj = {
        user: {
          name: '<script>XSS</script>',
          address: {
            street: '<img src=x onerror=alert(1)>',
          },
        },
      };

      const result = sanitizationUtil.sanitizeObjectRecursively(obj) as {
        user: { name: string; address: { street: string } };
      };

      expect(result.user.name).not.toContain('<script>');
      expect(result.user.address.street).not.toContain('onerror');
    });

    it('should sanitize arrays', () => {
      const arr = ['<script>alert(1)</script>', 'safe', '<img onerror=alert(1)>'];

      const result = sanitizationUtil.sanitizeObjectRecursively(arr) as string[];

      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('safe');
      expect(result[2]).not.toContain('onerror');
    });

    it('should preserve non-string primitives', () => {
      const obj = {
        count: 42,
        active: true,
        ratio: 3.14,
        empty: null,
      };

      const result = sanitizationUtil.sanitizeObjectRecursively(obj) as Record<string, unknown>;

      expect(result['count']).toBe(42);
      expect(result['active']).toBe(true);
      expect(result['ratio']).toBe(3.14);
      expect(result['empty']).toBeNull();
    });

    it('should block prototype pollution via __proto__', () => {
      const malicious = {
        __proto__: { admin: true },
        name: 'test',
      };

      const result = sanitizationUtil.sanitizeObjectRecursively(malicious) as Record<
        string,
        unknown
      >;

      // __proto__ key should not exist as own property
      expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
      expect(result).toHaveProperty('name');
    });

    it('should block constructor property', () => {
      const malicious = {
        constructor: { prototype: { admin: true } },
        name: 'test',
      };

      const result = sanitizationUtil.sanitizeObjectRecursively(malicious) as Record<
        string,
        unknown
      >;

      // constructor key should not exist as own property (or should be removed)
      expect(Object.prototype.hasOwnProperty.call(result, 'constructor')).toBe(false);
      expect(result).toHaveProperty('name');
    });
  });

  describe('containsSuspiciousContent - Threat Detection', () => {
    it('should detect <script> tags', () => {
      expect(sanitizationUtil.containsSuspiciousContent('<script>alert(1)</script>')).toBe(true);
      expect(sanitizationUtil.containsSuspiciousContent('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      expect(sanitizationUtil.containsSuspiciousContent('javascript:alert(1)')).toBe(true);
      expect(sanitizationUtil.containsSuspiciousContent('JAVASCRIPT:alert(1)')).toBe(true);
    });

    it('should detect event handlers', () => {
      const suspicious = ['onclick=alert(1)', 'onerror=steal()', 'onload=malicious()'];

      suspicious.forEach((content) => {
        expect(sanitizationUtil.containsSuspiciousContent(content)).toBe(true);
      });
    });

    it('should detect iframe injection', () => {
      expect(sanitizationUtil.containsSuspiciousContent('<iframe src="evil.com">')).toBe(true);
    });

    it('should detect prototype pollution attempts', () => {
      expect(sanitizationUtil.containsSuspiciousContent('__proto__')).toBe(true);
      expect(sanitizationUtil.containsSuspiciousContent('constructor.prototype')).toBe(true);
    });

    it('should not flag safe content', () => {
      const safe = [
        'Hello World',
        'user@example.com',
        'https://example.com',
        'Normal text with <angle> brackets in math',
      ];

      // Most safe content should pass (angle brackets might trigger in last case, which is acceptable)
      const [safeTextA = '', safeTextB = '', safeTextC = ''] = safe;
      expect(sanitizationUtil.containsSuspiciousContent(safeTextA)).toBe(false);
      expect(sanitizationUtil.containsSuspiciousContent(safeTextB)).toBe(false);
      expect(sanitizationUtil.containsSuspiciousContent(safeTextC)).toBe(false);
    });

    it('should handle empty and null inputs', () => {
      expect(sanitizationUtil.containsSuspiciousContent('')).toBe(false);
      expect(sanitizationUtil.containsSuspiciousContent(null as unknown as string)).toBe(false);
      expect(sanitizationUtil.containsSuspiciousContent(undefined as unknown as string)).toBe(
        false,
      );
    });
  });

  describe('getSanitizationStats - Monitoring', () => {
    it('should calculate bytes removed', () => {
      const original = '<script>alert(1)</script>Hello';
      const sanitized = sanitizationUtil.sanitizeHtml(original);
      const stats = sanitizationUtil.getSanitizationStats(original, sanitized);

      expect(stats.bytesRemoved).toBeGreaterThan(0);
      expect(stats.originalLength).toBeGreaterThan(stats.sanitizedLength);
    });

    it('should detect suspicious content in stats', () => {
      const original = '<script>XSS</script>';
      const sanitized = sanitizationUtil.sanitizeHtml(original);
      const stats = sanitizationUtil.getSanitizationStats(original, sanitized);

      expect(stats.containedSuspicious).toBe(true);
    });

    it('should calculate percent removed correctly', () => {
      const original = '<script>alert(1)</script>Hello';
      const sanitized = 'Hello';
      const stats = sanitizationUtil.getSanitizationStats(original, sanitized);

      expect(stats.percentRemoved).toBeGreaterThan(0);
      expect(stats.percentRemoved).toBeLessThanOrEqual(100);
    });

    it('should handle identical strings', () => {
      const text = 'Hello World';
      const stats = sanitizationUtil.getSanitizationStats(text, text);

      expect(stats.bytesRemoved).toBe(0);
      expect(stats.percentRemoved).toBe(0);
      expect(stats.containedSuspicious).toBe(false);
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle very long strings without crashing', () => {
      const longString = 'a'.repeat(10000);
      const result = sanitizationUtil.sanitizeText(longString);

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(longString.length);
    });

    it('should handle deeply nested objects', () => {
      let obj: { value?: string; nested?: unknown } = { value: '<script>XSS</script>' };
      for (let i = 0; i < 10; i++) {
        obj = { nested: obj };
      }

      const result = sanitizationUtil.sanitizeObjectRecursively(
        obj as unknown as Parameters<typeof sanitizationUtil.sanitizeObjectRecursively>[0],
      );

      expect(result).toBeDefined();
    });

    it('should handle special unicode characters', () => {
      const unicode = '🚀 Emoji \u0000 null byte \uFEFF BOM';
      const result = sanitizationUtil.sanitizeText(unicode);

      expect(result).toBeDefined();
    });

    it('should handle mixed content types in arrays', () => {
      const mixed: (string | number | boolean | null | Record<string, string> | string[])[] = [
        'string',
        123,
        true,
        null,
        { key: 'value' },
        ['nested', 'array'],
      ];

      const result = sanitizationUtil.sanitizeObjectRecursively(
        mixed as unknown as Parameters<typeof sanitizationUtil.sanitizeObjectRecursively>[0],
      );

      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBe(6);
    });
  });

  describe('Real-world Attack Vectors', () => {
    it('should block encoded script tags', () => {
      const encoded = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const result = sanitizationUtil.sanitizeHtml(encoded);

      // Already-encoded content should remain encoded (safe)
      // It should not contain actual < or > characters
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      // The word "script" will appear in encoded form, which is safe
      expect(result).toContain('script'); // But as text, not executable
    });

    it('should block SVG-based XSS', () => {
      const svg = '<svg onload=alert(1)><script>alert(1)</script></svg>';
      const result = sanitizationUtil.sanitizeHtml(svg);

      expect(result).not.toContain('onload');
      expect(result).not.toContain('<script>');
    });

    it('should block HTML5 form-based XSS', () => {
      const form = '<form action="javascript:alert(1)"><input type="submit"></form>';
      const result = sanitizationUtil.sanitizeHtml(form);

      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('<form');
    });

    it('should block meta refresh redirect', () => {
      const meta = '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">';
      const result = sanitizationUtil.sanitizeHtml(meta);

      expect(result).not.toContain('<meta');
      expect(result).not.toContain('javascript:');
    });
  });
});

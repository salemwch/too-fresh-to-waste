import { Injectable, Logger } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

// Type definitions for sanitization operations
type SanitizableValue = string | number | boolean | null | undefined;
type SanitizableArray = (SanitizableValue | SanitizableObject)[];
interface SanitizableObject {
  [key: string]: SanitizableValue | SanitizableArray | SanitizableObject | SanitizableObject[];
}
type SanitizableInput =
  | SanitizableValue
  | SanitizableArray
  | SanitizableObject
  | SanitizableObject[];

interface NotificationPayload {
  title: string;
  body: string;
  data?: SanitizableObject;
  image?: string;
  clickAction?: string;
  [key: string]: SanitizableInput;
}

interface TemplateVariables {
  [key: string]: SanitizableInput;
}

/**
 * Enterprise-grade sanitization utility using sanitize-html package
 * Replaces regex-based sanitization for production-level security
 *
 * @see https://www.npmjs.com/package/sanitize-html
 * @rationale Production-grade XSS prevention requires AST-based HTML parsing, not regex
 */
@Injectable()
export class SanitizationUtil {
  private readonly logger = new Logger(SanitizationUtil.name);

  /**
   * Production-grade HTML sanitization configuration
   * Uses sanitize-html library with strict whitelist
   */
  private readonly strictHtmlOptions: sanitizeHtml.IOptions = {
    // Whitelist approach: only allow safe tags
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'span', 'ul', 'ol', 'li', 'a'],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      span: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
    },
    // Remove all tags not whitelisted
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    // Enforce proper nesting
    enforceHtmlBoundary: true,
    // Transform tags to safe alternatives
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          // Force external links to open in new tab with security
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
    },
  };

  /**
   * Zero-HTML configuration for plain text
   * Strips all HTML completely
   */
  private readonly textOnlyOptions: sanitizeHtml.IOptions = {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  };

  /**
   * Email template configuration
   * Allows more HTML for formatted emails
   */
  private readonly emailHtmlOptions: sanitizeHtml.IOptions = {
    allowedTags: [
      'b',
      'i',
      'em',
      'strong',
      'p',
      'br',
      'span',
      'div',
      'ul',
      'ol',
      'li',
      'a',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['class', 'style'],
      div: ['class', 'style'],
      p: ['class', 'style'],
      table: ['class', 'style', 'border', 'cellpadding', 'cellspacing'],
      td: ['class', 'style', 'colspan', 'rowspan'],
      th: ['class', 'style', 'colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'data'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowedStyles: {
      '*': {
        color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
        'text-align': [/^left$/, /^right$/, /^center$/],
        'font-size': [/^\d+(?:px|em|%)$/],
        'font-weight': [/^bold$/, /^normal$/],
        padding: [/^\d+(?:px|em|%)$/],
        margin: [/^\d+(?:px|em|%)$/],
      },
    },
  };

  /**
   * Sanitize HTML content using production-grade sanitize-html library
   * Replaces vulnerable regex-based approach
   *
   * @param input - HTML string to sanitize
   * @param options - Optional custom sanitization options
   * @returns Sanitized HTML string
   */
  sanitizeHtml(input: string, options?: sanitizeHtml.IOptions): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    try {
      const sanitized = sanitizeHtml(input, options ?? this.strictHtmlOptions);

      // Log if content was modified significantly
      if (input.length - sanitized.length > 100) {
        this.logger.debug(`Sanitized HTML: removed ${input.length - sanitized.length} characters`);
      }

      return sanitized.trim();
    } catch (error) {
      this.logger.error('HTML sanitization error:', error);
      // Fallback to text-only if sanitization fails
      return this.sanitizeText(input);
    }
  }

  /**
   * Sanitize plain text by stripping all HTML tags.
   * Does NOT encode HTML entities — this stores clean plain text in the
   * database. React Native / JSON consumers are not browsers and must not
   * receive entity-encoded strings.
   *
   * Strategy:
   *  1. Decode any pre-existing entities (normalises &amp; → &, etc.)
   *  2. Strip all HTML tags via sanitize-html (XSS prevention)
   *  3. Decode entities that sanitize-html re-introduced in step 2
   *
   * @param input - Plain text string (may already contain HTML entities)
   * @returns Plain text with all HTML stripped, entities decoded
   */
  sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Step 1 — normalise: decode any pre-existing entity encoding
    const normalised = this.decodeHtmlEntities(input);

    // Step 2 — strip HTML tags (AST-based, prevents XSS)
    const stripped = sanitizeHtml(normalised, this.textOnlyOptions);

    // Step 3 — decode entities that sanitize-html re-introduced
    return this.decodeHtmlEntities(stripped).trim();
  }

  /**
   * Decode common HTML entities to their plain-text equivalents.
   * Used internally to ensure plain-text storage without entity encoding.
   */
  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#39;/g, "'");
  }

  /**
   * Sanitize notification payload for safe processing
   * Notifications must not contain HTML
   *
   * @param payload - Notification payload object
   * @returns Sanitized notification payload
   */
  sanitizeNotificationPayload(payload: unknown): NotificationPayload {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      return {
        title: '',
        body: '',
      };
    }

    const inputPayload = payload as NotificationPayload;
    const sanitized: NotificationPayload = {
      ...inputPayload,
      title: inputPayload.title ?? '',
      body: inputPayload.body ?? '',
    };

    // Sanitize title and body as text (no HTML allowed in notifications)
    sanitized.title = sanitized.title ? this.sanitizeText(String(sanitized.title)) : '';
    sanitized.body = sanitized.body ? this.sanitizeText(String(sanitized.body)) : '';

    // Sanitize data object recursively
    if (sanitized.data && typeof sanitized.data === 'object') {
      sanitized.data = this.sanitizeObjectRecursively(sanitized.data) as SanitizableObject;
    }

    // Validate and sanitize URLs
    if (sanitized.image) {
      sanitized.image = this.sanitizeUrl(String(sanitized.image));
    }

    if (sanitized.clickAction) {
      sanitized.clickAction = this.sanitizeUrl(String(sanitized.clickAction));
    }

    return sanitized;
  }

  /**
   * Recursively sanitize object properties
   * Applies text sanitization to all string values
   *
   * @param obj - Object to sanitize
   * @returns Sanitized object
   */
  sanitizeObjectRecursively(obj: SanitizableInput): SanitizableInput {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObjectRecursively(item)) as SanitizableArray;
    }

    if (typeof obj !== 'object') {
      return typeof obj === 'string' ? this.sanitizeText(obj) : obj;
    }

    const sanitized: SanitizableObject = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys to prevent prototype pollution
      const sanitizedKey = this.sanitizeObjectKey(key);
      if (sanitizedKey) {
        sanitized[sanitizedKey] = this.sanitizeObjectRecursively(value);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize object keys to prevent prototype pollution attacks
   *
   * @param key - Object key to validate
   * @returns Sanitized key or empty string if dangerous
   */
  private sanitizeObjectKey(key: string): string {
    // Block dangerous prototype pollution keys
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

    if (dangerousKeys.includes(key)) {
      this.logger.warn(`Blocked dangerous object key: ${key}`);
      return '';
    }

    // Sanitize key as text
    return this.sanitizeText(key);
  }

  /**
   * Sanitize and validate URLs
   * Only allows http, https, and relative URLs
   *
   * @param url - URL string to sanitize
   * @returns Sanitized URL or empty string if invalid
   */
  sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Remove potential XSS vectors using sanitize-html
    const sanitized = sanitizeHtml(url, {
      allowedTags: [],
      allowedAttributes: {},
      allowedSchemes: ['http', 'https'],
    }).trim();

    // Validate URL format
    try {
      const parsed = new URL(sanitized);
      // Only allow http and https protocols
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return sanitized;
      }
      // Block javascript:, data:, vbscript:, etc.
      this.logger.warn(`Blocked unsafe URL protocol: ${parsed.protocol}`);
      return '';
    } catch {
      // If it's not a valid absolute URL, check if it's a safe relative path
      if (sanitized.startsWith('/') && !sanitized.startsWith('//')) {
        // Safe relative path
        return sanitized;
      }
      if (sanitized.startsWith('./')) {
        // Safe relative path with explicit current directory
        return sanitized;
      }
    }

    this.logger.warn(`Potentially unsafe URL blocked: ${url.substring(0, 50)}...`);
    return '';
  }

  /**
   * Sanitize template variables for email templates
   * Allows HTML with strict whitelist
   *
   * @param variables - Template variables object
   * @returns Sanitized variables
   */
  sanitizeTemplateVariables(variables: unknown): TemplateVariables {
    if (variables === null || variables === undefined || typeof variables !== 'object') {
      return {};
    }

    const inputVariables = variables as TemplateVariables;
    const sanitized: TemplateVariables = {};

    for (const [key, value] of Object.entries(inputVariables)) {
      // Only allow alphanumeric and underscore in variable names
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '');

      if (!sanitizedKey) {
        this.logger.warn(`Skipped invalid template variable key: ${key}`);
        continue;
      }

      if (typeof value === 'string') {
        // For email templates, allow limited HTML but sanitize it
        sanitized[sanitizedKey] = this.sanitizeHtml(value, this.emailHtmlOptions);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = this.sanitizeObjectRecursively(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }

  /**
   * Validate that input doesn't contain suspicious XSS patterns
   * Used for logging and alerting, not primary defense
   *
   * @param input - String to check
   * @returns True if suspicious content detected
   */
  containsSuspiciousContent(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i, // Event handlers (onclick, onerror, etc.)
      /expression\s*\(/i,
      /@import/i,
      /data:text\/html/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /__proto__/i,
      /constructor.*prototype/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Get sanitization statistics for monitoring
   *
   * @param original - Original input
   * @param sanitized - Sanitized output
   * @returns Object with statistics
   */
  getSanitizationStats(
    original: string,
    sanitized: string,
  ): {
    originalLength: number;
    sanitizedLength: number;
    bytesRemoved: number;
    percentRemoved: number;
    containedSuspicious: boolean;
  } {
    const originalLength = original.length;
    const sanitizedLength = sanitized.length;
    const bytesRemoved = originalLength - sanitizedLength;
    const percentRemoved = originalLength > 0 ? (bytesRemoved / originalLength) * 100 : 0;
    const containedSuspicious = this.containsSuspiciousContent(original);

    return {
      originalLength,
      sanitizedLength,
      bytesRemoved,
      percentRemoved: Math.round(percentRemoved * 100) / 100,
      containedSuspicious,
    };
  }
}

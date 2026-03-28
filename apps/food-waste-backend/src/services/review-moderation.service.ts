import { Injectable, Logger } from '@nestjs/common';

export interface ModerationResult {
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  reason?: string;
  flags: string[];
  confidence: number;
}

export interface ReviewModerationData {
  content: string;
  title?: string | undefined;
  rating?: number | undefined;
  images?: { url: string; mimeType: string; size?: number }[] | undefined;
}

@Injectable()
export class ReviewModerationService {
  private readonly logger = new Logger(ReviewModerationService.name);

  // Profanity and inappropriate content lists
  private readonly profanityList = [
    'spam',
    'scam',
    'fake',
    'bot',
    'advertisement',
    'promotion',
    // Add more inappropriate words as needed
    'stupid',
    'idiot',
    'moron',
    'dumb',
    'hate',
    'kill',
    'die',
  ];

  private readonly spamIndicators = [
    /https?:\/\//gi, // URLs
    /www\./gi, // Website references
    /\b(call|contact|phone)\s*:?\s*\d+/gi, // Phone numbers
    /\b(email|e-mail)\s*:?\s*\w+@\w+/gi, // Email addresses
    /\b(buy|sell|discount|offer|deal|cheap|free|win|winner|prize)\b/gi, // Commercial terms
    /(.)\1{4,}/g, // Repeated characters (aaaaa, !!!!!!)
    /\b(click|visit|check out|follow|subscribe)\b/gi, // Call-to-action words
  ];

  private readonly suspiciousPatterns = [
    /\b(first|1st)\s+(review|time)\b/gi, // Fake first-time indicators
    /\b(paid|fake|bot|generated)\b/gi, // Fake review indicators
    /\b(best|worst)\s+(ever|place|food)\b/gi, // Extreme language
    /\$\d+/g, // Money references
    /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, // Credit card patterns
  ];

  /**
   * Check if content contains profanity or inappropriate language
   */
  checkForProfanity(content: string): boolean {
    try {
      if (!content || typeof content !== 'string') {
        return false; // No content to check
      }

      const lowercaseContent = content.toLowerCase();

      // Check for explicit profanity
      const hasProfanity = this.profanityList.some((word) =>
        lowercaseContent.includes(word.toLowerCase()),
      );

      // Check for spam patterns
      const hasSpamPatterns = this.spamIndicators.some((pattern) => pattern.test(content));

      // Check for suspicious patterns
      const hasSuspiciousPatterns = this.suspiciousPatterns.some((pattern) =>
        pattern.test(content),
      );

      const containsInappropriateContent = hasProfanity || hasSpamPatterns || hasSuspiciousPatterns;

      if (containsInappropriateContent) {
        this.logger.warn(
          `Content flagged for inappropriate language: ${content.substring(0, 50)}...`,
        );
      }

      return containsInappropriateContent;
    } catch (error) {
      this.logger.error('Error checking for profanity:', error);
      return false; // On error, assume content is clean
    }
  }

  /**
   * Validate content structure and quality
   */
  validateContent(content: string): boolean {
    try {
      if (!content || typeof content !== 'string') {
        return false;
      }

      const trimmedContent = content.trim();

      // Basic validation rules
      const validations = {
        hasMinLength: trimmedContent.length >= 10,
        hasMaxLength: trimmedContent.length <= 2000,
        hasAlphabeticContent: /[a-zA-Z]/.test(trimmedContent),
        notOnlyNumbers: !/^\d+$/.test(trimmedContent),
        notOnlySpecialChars: !/^[^a-zA-Z0-9\s]+$/.test(trimmedContent),
        notRepeatedChars: !/(.)(\1){10,}/.test(trimmedContent), // No more than 10 repeated chars
        hasReasonableWordCount: this.getWordCount(trimmedContent) >= 3,
        notAllCaps: !this.isAllCaps(trimmedContent),
      };

      // Check if content passes basic validation
      const isValid = Object.values(validations).every((validation) => validation === true);

      if (!isValid) {
        this.logger.warn(
          `Content failed validation: ${JSON.stringify(validations)} - Content: ${content.substring(0, 50)}...`,
        );
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error validating content:', error);
      return false;
    }
  }

  /**
   * Complete moderation pipeline
   */
  moderateReview(reviewData: ReviewModerationData): ModerationResult & { moderatedAt: Date } {
    try {
      const flags: string[] = [];
      let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'APPROVED';
      let reason = '';
      let confidence = 0.8; // Default confidence

      this.applyContentChecks(reviewData, flags, (newStatus, newReason, newConfidence) => {
        status = newStatus;
        reason = newReason;
        confidence = newConfidence;
      });

      this.applyTitleChecks(reviewData, flags, (newStatus, newReason, newConfidence) => {
        status = newStatus;
        reason = newReason;
        confidence = newConfidence;
      });

      this.applyRatingChecks(reviewData, flags, (newStatus, newReason, newConfidence) => {
        status = newStatus;
        reason = newReason;
        confidence = newConfidence;
      });

      this.applyImageChecks(reviewData, flags, (newStatus, newReason, newConfidence) => {
        status = newStatus;
        reason = newReason;
        confidence = newConfidence;
      });

      this.applyLengthAndBotChecks(reviewData, flags, (newStatus, newReason, newConfidence) => {
        status = newStatus;
        reason = newReason;
        confidence = newConfidence;
      });

      // Final decision logic
      if (flags.length === 0) {
        status = 'APPROVED';
        reason = 'Content passed all moderation checks';
        confidence = 0.9;
      } else if (flags.length >= 3) {
        status = 'REJECTED';
        reason = 'Multiple moderation violations detected';
        confidence = 0.95;
      }

      const result = {
        status,
        reason,
        flags,
        confidence,
        moderatedAt: new Date(),
      };

      this.logger.log(`Review moderated: ${status} (${flags.length} flags: ${flags.join(', ')})`);

      return result;
    } catch (error) {
      this.logger.error('Error in moderation pipeline:', error);

      // On error, require manual review
      return {
        status: 'PENDING',
        reason: 'Moderation error - requires manual review',
        flags: ['moderation_error'],
        confidence: 0.0,
        moderatedAt: new Date(),
      };
    }
  }

  private applyContentChecks(
    reviewData: ReviewModerationData,
    flags: string[],
    update: (
      status: 'APPROVED' | 'REJECTED' | 'PENDING',
      reason: string,
      confidence: number,
    ) => void,
  ) {
    let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'APPROVED';
    let reason = '';
    let confidence = 0.8;

    const hasProfanity = this.checkForProfanity(reviewData.content);
    if (hasProfanity) {
      flags.push('inappropriate_content');
      status = 'REJECTED';
      reason = 'Content contains inappropriate language or spam';
      confidence = 0.9;
    }

    const isValidContent = this.validateContent(reviewData.content);
    if (!isValidContent) {
      flags.push('invalid_content');
      if (status !== 'REJECTED') {
        status = 'PENDING';
        reason = 'Content does not meet quality standards';
      }
      confidence = Math.min(confidence, 0.6);
    }

    update(status, reason, confidence);
  }

  private applyTitleChecks(
    reviewData: ReviewModerationData,
    flags: string[],
    update: (
      status: 'APPROVED' | 'REJECTED' | 'PENDING',
      reason: string,
      confidence: number,
    ) => void,
  ) {
    let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'APPROVED';
    let reason = '';
    let confidence = 0.8;

    if (reviewData.title) {
      const hasTitleProfanity = this.checkForProfanity(reviewData.title);
      if (hasTitleProfanity) {
        flags.push('inappropriate_title');
        status = 'REJECTED';
        reason = 'Title contains inappropriate content';
        confidence = 0.9;
      }
    }

    update(status, reason, confidence);
  }

  private applyRatingChecks(
    reviewData: ReviewModerationData,
    flags: string[],
    update: (
      status: 'APPROVED' | 'REJECTED' | 'PENDING',
      reason: string,
      confidence: number,
    ) => void,
  ) {
    let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'APPROVED';
    let reason = '';
    let confidence = 0.8;

    if (reviewData.rating !== undefined) {
      if (reviewData.rating < 1 || reviewData.rating > 5) {
        flags.push('invalid_rating');
        status = 'REJECTED';
        reason = 'Invalid rating value';
        confidence = 1.0;
      }

      if (this.isSuspiciousRating(reviewData.rating, reviewData.content)) {
        flags.push('suspicious_rating');
        if (status === 'APPROVED') {
          status = 'PENDING';
          reason = 'Rating inconsistent with review content';
        }
        confidence = Math.min(confidence, 0.5);
      }
    }

    update(status, reason, confidence);
  }

  private applyImageChecks(
    reviewData: ReviewModerationData,
    flags: string[],
    update: (
      status: 'APPROVED' | 'REJECTED' | 'PENDING',
      reason: string,
      confidence: number,
    ) => void,
  ) {
    let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'APPROVED';
    let reason = '';
    let confidence = 0.8;

    if (reviewData.images && reviewData.images.length > 0) {
      const imageValidation = this.validateImages(reviewData.images);
      if (!imageValidation.isValid) {
        flags.push('invalid_images');
        if (status === 'APPROVED') {
          status = 'PENDING';
          reason = imageValidation.reason || 'Images require manual review';
        }
        confidence = Math.min(confidence, 0.7);
      }
    }

    update(status, reason, confidence);
  }

  private applyLengthAndBotChecks(
    reviewData: ReviewModerationData,
    flags: string[],
    update: (
      status: 'APPROVED' | 'REJECTED' | 'PENDING',
      reason: string,
      confidence: number,
    ) => void,
  ) {
    let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'APPROVED';
    let reason = '';
    let confidence = 0.8;

    if (reviewData.content.length < 20) {
      flags.push('too_short');
      confidence = Math.min(confidence, 0.6);
    }

    if (this.isBotLikeContent(reviewData.content)) {
      flags.push('potential_bot');
      if (status === 'APPROVED') {
        status = 'PENDING';
        reason = 'Content appears to be auto-generated';
      }
      confidence = Math.min(confidence, 0.4);
    }

    update(status, reason, confidence);
  }

  // Helper methods

  private getWordCount(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private isAllCaps(text: string): boolean {
    const alphaChars = text.replace(/[^a-zA-Z]/g, '');
    return alphaChars.length > 5 && alphaChars === alphaChars.toUpperCase();
  }

  private isSuspiciousRating(rating: number, content: string): boolean {
    const positiveWords = [
      'great',
      'excellent',
      'amazing',
      'wonderful',
      'love',
      'perfect',
      'awesome',
      'fantastic',
    ];
    const negativeWords = [
      'terrible',
      'awful',
      'bad',
      'horrible',
      'hate',
      'worst',
      'disgusting',
      'disappointing',
    ];

    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter((word) => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter((word) => lowerContent.includes(word)).length;

    // 5-star rating with mostly negative words
    if (rating >= 4 && negativeCount > positiveCount && negativeCount > 1) {
      return true;
    }

    // 1-2 star rating with mostly positive words
    if (rating <= 2 && positiveCount > negativeCount && positiveCount > 1) {
      return true;
    }

    return false;
  }

  private validateImages(images: { url: string; mimeType: string; size?: number }[]): {
    isValid: boolean;
    reason?: string;
  } {
    try {
      if (images.length > 10) {
        return { isValid: false, reason: 'Too many images' };
      }

      for (const image of images) {
        if (!image.url || !image.mimeType) {
          return { isValid: false, reason: 'Invalid image format' };
        }

        if (!image.mimeType.startsWith('image/')) {
          return { isValid: false, reason: 'Invalid file type' };
        }

        if (image.size && image.size > 10 * 1024 * 1024) {
          // 10MB limit
          return { isValid: false, reason: 'Image too large' };
        }
      }

      return { isValid: true };
    } catch (error) {
      this.logger.error('Error validating images:', error);
      return { isValid: false, reason: 'Image validation error' };
    }
  }

  private isBotLikeContent(content: string): boolean {
    // Check for repetitive patterns
    const words = content.toLowerCase().split(/\s+/);

    // Too many repeated words
    const uniqueWords = new Set(words);
    if (words.length > 10 && uniqueWords.size / words.length < 0.5) {
      return true;
    }

    // Generic phrases that bots often use
    const genericPhrases = [
      'i really enjoyed',
      'would definitely recommend',
      'great place to',
      'highly recommend this',
      'amazing experience',
      'perfect for',
    ];

    const hasGenericPhrases = genericPhrases.filter((phrase) =>
      content.toLowerCase().includes(phrase),
    ).length;

    return hasGenericPhrases >= 2;
  }
}

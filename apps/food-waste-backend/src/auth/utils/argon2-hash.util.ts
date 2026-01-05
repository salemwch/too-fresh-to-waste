import * as argon2 from 'argon2';
import { Logger } from '@nestjs/common';

/**
 * Argon2 Hash Utility
 *
 * Provides utilities for working with Argon2 password hashes including:
 * - Parameter extraction from encoded hash strings
 * - Verification of hash cost factors
 * - Validation of recommended security parameters
 *
 * Argon2 PHC Format:
 * $argon2<variant>$v=<version>$m=<memory>,t=<time>,p=<parallelism>$<salt>$<hash>
 *
 * Example:
 * $argon2id$v=19$m=65536,t=3,p=1$base64salt$base64hash
 *
 * @see https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md
 * @see https://datatracker.ietf.org/doc/html/rfc9106
 * @see https://github.com/ranisalt/node-argon2
 */

export interface Argon2Parameters {
  /** Argon2 variant: argon2i, argon2d, or argon2id */
  variant: 'argon2i' | 'argon2d' | 'argon2id';
  /** Version number (19 = 0x13 for Argon2 v1.3) */
  version: number;
  /** Memory cost in KiB (2^16 = 65536 KiB = 64 MiB) */
  memoryCost: number;
  /** Time cost (number of iterations) */
  timeCost: number;
  /** Parallelism (number of threads) */
  parallelism: number;
  /** Base64-encoded salt */
  salt: string;
  /** Base64-encoded hash */
  hash: string;
}

export interface Argon2Verification {
  /** Whether the hash meets minimum security requirements */
  meetsMinimumRequirements: boolean;
  /** Whether Argon2id (recommended variant) is used */
  usesRecommendedVariant: boolean;
  /** Extracted parameters from the hash */
  parameters: Argon2Parameters;
  /** Security assessment warnings */
  warnings: string[];
  /** Security assessment suggestions */
  suggestions: string[];
}

/**
 * Recommended Argon2id parameters (OWASP 2023)
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export const RECOMMENDED_ARGON2_PARAMS = {
  // Minimum values (OWASP minimum for security)
  MIN_MEMORY_COST: 19456, // ~19 MiB (minimum for security)
  MIN_TIME_COST: 2,
  MIN_PARALLELISM: 1,

  // Recommended values (good balance of security and performance)
  RECOMMENDED_MEMORY_COST: 65536, // 64 MiB (2^16 KiB)
  RECOMMENDED_TIME_COST: 3,
  RECOMMENDED_PARALLELISM: 1,

  // High security values (for sensitive applications)
  HIGH_MEMORY_COST: 262144, // 256 MiB (2^18 KiB)
  HIGH_TIME_COST: 5,
  HIGH_PARALLELISM: 4,

  RECOMMENDED_VARIANT: 'argon2id' as const,
} as const;

const logger = new Logger('Argon2HashUtil');

/**
 * Parse Argon2 hash string and extract parameters
 *
 * PHC Format: $argon2<variant>$v=<version>$m=<memory>,t=<time>,p=<parallelism>$<salt>$<hash>
 *
 * @param hashString - Argon2 encoded hash string
 * @returns Parsed Argon2 parameters
 * @throws Error if hash format is invalid
 */
export function parseArgon2Hash(hashString: string): Argon2Parameters {
  try {
    const parts = hashString.split('$');

    // Valid Argon2 hash should have 6 parts (including empty first element from leading $)
    // Example: ['', 'argon2id', 'v=19', 'm=65536,t=3,p=1', 'salt', 'hash']
    if (parts.length !== 6) {
      throw new Error(`Invalid Argon2 hash format: expected 6 parts, got ${parts.length}`);
    }

    // Extract variant (argon2i, argon2d, argon2id)
    const variantMatch = parts[1].match(/^argon2(i|d|id)$/);
    if (!variantMatch) {
      throw new Error(`Invalid Argon2 variant: ${parts[1]}`);
    }
    const variant = `argon2${variantMatch[1]}` as 'argon2i' | 'argon2d' | 'argon2id';

    // Extract version
    const versionMatch = parts[2].match(/^v=(\d+)$/);
    if (!versionMatch) {
      throw new Error(`Invalid version format: ${parts[2]}`);
    }
    const version = parseInt(versionMatch[1], 10);

    // Extract memory, time, and parallelism parameters
    const paramsMatch = parts[3].match(/^m=(\d+),t=(\d+),p=(\d+)$/);
    if (!paramsMatch) {
      throw new Error(`Invalid parameters format: ${parts[3]}`);
    }

    const memoryCost = parseInt(paramsMatch[1], 10);
    const timeCost = parseInt(paramsMatch[2], 10);
    const parallelism = parseInt(paramsMatch[3], 10);

    return {
      variant,
      version,
      memoryCost,
      timeCost,
      parallelism,
      salt: parts[4],
      hash: parts[5],
    };
  } catch (error) {
    logger.error('Failed to parse Argon2 hash', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error(`Failed to parse Argon2 hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify that Argon2 hash meets minimum security requirements
 *
 * @param hashString - Argon2 encoded hash string
 * @returns Verification result with security assessment
 */
export function verifyArgon2Parameters(hashString: string): Argon2Verification {
  const params = parseArgon2Hash(hashString);
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check variant
  const usesRecommendedVariant = params.variant === RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_VARIANT;
  if (!usesRecommendedVariant) {
    warnings.push(`Using ${params.variant} instead of recommended argon2id`);
    suggestions.push('Migrate to argon2id for better resistance to side-channel and GPU attacks');
  }

  // Check memory cost
  let meetsMemoryRequirement = true;
  if (params.memoryCost < RECOMMENDED_ARGON2_PARAMS.MIN_MEMORY_COST) {
    warnings.push(
      `Memory cost ${params.memoryCost} KiB is below minimum ${RECOMMENDED_ARGON2_PARAMS.MIN_MEMORY_COST} KiB`
    );
    suggestions.push(
      `Increase memory cost to at least ${RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_MEMORY_COST} KiB (64 MiB)`
    );
    meetsMemoryRequirement = false;
  } else if (params.memoryCost < RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_MEMORY_COST) {
    suggestions.push(
      `Consider increasing memory cost to ${RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_MEMORY_COST} KiB for better security`
    );
  }

  // Check time cost
  let meetsTimeRequirement = true;
  if (params.timeCost < RECOMMENDED_ARGON2_PARAMS.MIN_TIME_COST) {
    warnings.push(
      `Time cost ${params.timeCost} is below minimum ${RECOMMENDED_ARGON2_PARAMS.MIN_TIME_COST}`
    );
    suggestions.push(
      `Increase time cost to at least ${RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_TIME_COST}`
    );
    meetsTimeRequirement = false;
  } else if (params.timeCost < RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_TIME_COST) {
    suggestions.push(
      `Consider increasing time cost to ${RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_TIME_COST} for better security`
    );
  }

  // Check parallelism
  let meetsParallelismRequirement = true;
  if (params.parallelism < RECOMMENDED_ARGON2_PARAMS.MIN_PARALLELISM) {
    warnings.push(
      `Parallelism ${params.parallelism} is below minimum ${RECOMMENDED_ARGON2_PARAMS.MIN_PARALLELISM}`
    );
    meetsParallelismRequirement = false;
  }

  const meetsMinimumRequirements =
    meetsMemoryRequirement && meetsTimeRequirement && meetsParallelismRequirement;

  return {
    meetsMinimumRequirements,
    usesRecommendedVariant,
    parameters: params,
    warnings,
    suggestions,
  };
}

/**
 * Get current Argon2 configuration used for hashing
 * @returns Configuration object with hashing parameters
 */
export function getCurrentArgon2Config(): {
  type: typeof argon2.argon2id;
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  description: string;
} {
  return {
    type: argon2.argon2id,
    memoryCost: RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_MEMORY_COST,
    timeCost: RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_TIME_COST,
    parallelism: RECOMMENDED_ARGON2_PARAMS.RECOMMENDED_PARALLELISM,
    description: 'Argon2id with OWASP recommended parameters (64 MiB, t=3, p=1)',
  };
}

/**
 * Verify a password hash and extract its parameters
 * Useful for debugging and security audits
 *
 * @param hashString - Argon2 encoded hash string
 * @returns Formatted string with hash parameters and security assessment
 */
export function getHashInfo(hashString: string): string {
  try {
    const verification = verifyArgon2Parameters(hashString);
    const { parameters, meetsMinimumRequirements, usesRecommendedVariant, warnings, suggestions } =
      verification;

    let info = `Argon2 Hash Information:\n`;
    info += `  Variant: ${parameters.variant}${usesRecommendedVariant ? ' ✓' : ' ⚠️'}\n`;
    info += `  Version: ${parameters.version}\n`;
    info += `  Memory Cost: ${parameters.memoryCost} KiB (${(parameters.memoryCost / 1024).toFixed(1)} MiB)\n`;
    info += `  Time Cost: ${parameters.timeCost} iterations\n`;
    info += `  Parallelism: ${parameters.parallelism} threads\n`;
    info += `  Security: ${meetsMinimumRequirements ? 'Meets minimum requirements ✓' : 'Below minimum requirements ⚠️'}\n`;

    if (warnings.length > 0) {
      info += `\nWarnings:\n`;
      warnings.forEach((w) => (info += `  - ${w}\n`));
    }

    if (suggestions.length > 0) {
      info += `\nSuggestions:\n`;
      suggestions.forEach((s) => (info += `  - ${s}\n`));
    }

    return info;
  } catch (error) {
    return `Error parsing hash: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

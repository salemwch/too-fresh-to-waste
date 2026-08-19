/**
 * PasswordValidationService.generatePasswordSuggestion — entropy and policy
 *
 * These tests exist because the previous implementation was a credential
 * generator built on `Math.random()`:
 *
 *   8 adjectives x 8 nouns x 900 numbers x 7 symbols = 403,200 combinations
 *
 * That is ~2^18.6 — exhaustible offline in seconds — and `Math.random()` is
 * not a CSPRNG, so observing a few outputs narrows the next one further. A
 * suggestion a user adopts becomes their real password, so the weakness was
 * not theoretical.
 *
 * The assertions below are about the properties that make the replacement
 * safe, not about the specific characters it happens to emit:
 *
 *   - every draw satisfies the service's own policy (upper/lower/digit/
 *     special/length), so the generator cannot suggest something the validator
 *     would reject;
 *   - the character classes are not pinned to fixed positions, which is what
 *     fails if the Fisher-Yates shuffle is ever removed — without it the first
 *     four characters are always upper, lower, digit, special in that order,
 *     handing an attacker the structure for free;
 *   - no collisions across a large sample, which is the cheap observable proxy
 *     for "the keyspace is not 403,200".
 */

import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { User } from '../schemas/user.schema';
import { PasswordValidationService } from '../services/password-validation.service';

import type { TestingModule } from '@nestjs/testing';

/** Large enough that a positional bias or a small keyspace shows up. */
const SAMPLE = 500;

describe('PasswordValidationService.generatePasswordSuggestion', () => {
  let service: PasswordValidationService;
  let sample: string[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordValidationService, { provide: getModelToken(User.name), useValue: {} }],
    }).compile();

    service = module.get<PasswordValidationService>(PasswordValidationService);
    sample = Array.from({ length: SAMPLE }, () => service.generatePasswordSuggestion());
  });

  it('emits the declared length every time', () => {
    for (const password of sample) {
      expect(password).toHaveLength(20);
    }
  });

  it('always satisfies every character class the policy requires', () => {
    for (const password of sample) {
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%&*?\-_+=]/);
    }
  });

  it('excludes glyphs that are ambiguous when read aloud or transcribed', () => {
    for (const password of sample) {
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it('is accepted by the service’s own password policy', async () => {
    // The strongest available assertion: drive the output through the real
    // validator rather than re-encoding the policy in the test. Asserting the
    // individual requirement flags as well means a failure names the clause
    // that broke instead of just "not acceptable".
    //
    // Only a handful of samples here: validatePassword runs zxcvbn, which is
    // ~130ms per call and CPU-bound. The statistical properties are covered by
    // the full 500-draw sample in the cheap assertions above; this one is
    // checking a per-password invariant, which does not need volume. The
    // explicit timeout keeps it from flaking when jest workers compete for CPU
    // during a full-suite run — it passed alone and timed out in the suite.
    for (const password of sample.slice(0, 5)) {
      const result = await service.validatePassword(password);

      expect(result.requirements.minLength).toBe(true);
      expect(result.requirements.hasUppercase).toBe(true);
      expect(result.requirements.hasLowercase).toBe(true);
      expect(result.requirements.hasNumbers).toBe(true);
      expect(result.requirements.hasSpecialChars).toBe(true);
      expect(result.requirements.noCommonPatterns).toBe(true);
      expect(result.isAcceptable).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3); // defaultPolicy.minScore
    }
  }, 30_000);

  it('does not pin character classes to fixed positions', () => {
    // Remove the Fisher-Yates shuffle and this fails: position 0 becomes
    // uppercase in 100% of draws, position 2 always a digit, and so on.
    const classAt = (index: number, re: RegExp) =>
      sample.filter(password => re.test(password.charAt(index))).length / SAMPLE;

    expect(classAt(0, /[A-Z]/)).toBeLessThan(0.9);
    expect(classAt(1, /[a-z]/)).toBeLessThan(0.9);
    expect(classAt(2, /[0-9]/)).toBeLessThan(0.9);
    expect(classAt(3, /[!@#$%&*?\-_+=]/)).toBeLessThan(0.9);
  });

  it('produces no collisions across a large sample', () => {
    // At ~124 bits a collision in 500 draws is not reachable. At the old
    // 403,200-combination keyspace the birthday bound makes one likely.
    expect(new Set(sample).size).toBe(SAMPLE);
  });

  it('draws from a CSPRNG, not Math.random', () => {
    // Guards the specific regression: seeding Math.random cannot make the
    // output reproducible, because the generator must not consult it.
    const spy = jest.spyOn(Math, 'random');
    service.generatePasswordSuggestion();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

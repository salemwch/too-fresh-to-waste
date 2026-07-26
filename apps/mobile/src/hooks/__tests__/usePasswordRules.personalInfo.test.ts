/**
 * usePasswordRules — personal-information rule
 *
 * The hook accepted a `context` (email/name/phone), documented it as "for
 * personal info detection", and listed it as a dependency — but never read it.
 * The backend's passwordPolicyService rejects these on submit, so a user could
 * type their own email as a password, watch every rule turn green, and then be
 * refused by the server with no explanation of which rule they broke.
 *
 * These tests pin the client-side check to the same rule the server applies.
 */

import { renderHook } from '@testing-library/react-native';

import { usePasswordRules } from '../usePasswordRules';

import type { PasswordValidationContext } from '../usePasswordRules';

const CONTEXT: PasswordValidationContext = {
  email: 'salem.wachwacha@example.com',
  firstName: 'Salem',
  lastName: 'Wachwacha',
  phoneNumber: '+216 20 123 456',
};

const ruleFor = (password: string, context?: PasswordValidationContext) => {
  const { result } = renderHook(() => usePasswordRules(password, context));
  return result.current.rules.find(r => r.id === 'noPersonalInfo');
};

const isMet = (password: string, context?: PasswordValidationContext) =>
  ruleFor(password, context)?.isMet;

describe('usePasswordRules — noPersonalInfo', () => {
  it('exposes the rule', () => {
    expect(ruleFor('Str0ng!Passw0rd', CONTEXT)).toBeDefined();
  });

  describe('rejects a password containing identity', () => {
    it('flags the email local part', () => {
      expect(isMet('salem.wachwacha1!A', CONTEXT)).toBe(false);
    });

    it('flags the first name regardless of case', () => {
      expect(isMet('SALEM-Str0ng!x', CONTEXT)).toBe(false);
    });

    it('flags the last name', () => {
      expect(isMet('xWachwacha9!Qz', CONTEXT)).toBe(false);
    });

    // The stored number is formatted (+216 20 123 456) but a user types it
    // unspaced, so the comparison has to be digits-only or it never matches.
    it('flags the phone number typed without formatting', () => {
      expect(isMet('Ab!21620123456xy', CONTEXT)).toBe(false);
    });
  });

  describe('accepts what it should', () => {
    it('passes a strong unrelated password', () => {
      expect(isMet('Str0ng!Passw0rd', CONTEXT)).toBe(true);
    });

    it('passes when no context is supplied at all', () => {
      expect(isMet('salem.wachwacha1!A')).toBe(true);
    });

    it('passes when context fields are empty strings', () => {
      expect(isMet('Str0ng!Passw0rd', { email: '', firstName: '', lastName: '' })).toBe(true);
    });

    // Guards against false positives: a 1-2 character name would match almost
    // any password and make the rule impossible to satisfy.
    it('ignores personal fragments shorter than three characters', () => {
      expect(isMet('Str0ng!Passw0rd', { firstName: 'Jo' })).toBe(true);
    });

    it('does not flag an empty password', () => {
      expect(isMet('', CONTEXT)).toBe(true);
    });
  });

  describe('effect on overall validity', () => {
    it('an otherwise-strong password containing the name is not fully valid', () => {
      const { result } = renderHook(() => usePasswordRules('Salem!Str0ngPass', CONTEXT));
      const personalRule = result.current.rules.find(r => r.id === 'noPersonalInfo');

      expect(personalRule?.isMet).toBe(false);
      expect(result.current.isValid).toBe(false);
    });

    it('the same password without the name is valid', () => {
      const { result } = renderHook(() => usePasswordRules('Qu!etStr0ngPass', CONTEXT));
      expect(result.current.isValid).toBe(true);
    });
  });
});

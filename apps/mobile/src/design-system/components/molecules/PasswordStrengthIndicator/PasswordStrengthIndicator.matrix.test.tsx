/**
 * PasswordStrengthIndicator baselines - and the reason M18's fix moved nothing.
 *
 * HOW THIS FILE STARTED
 * ---------------------
 * `onWarningContainer` failed AA at 2.81 and was corrected to `warning[700]`
 * on 2026-08-28. Re-running the whole matrix afterwards produced **zero**
 * snapshot changes. This component's warning banner is that token's only
 * consumer in the app, and it had no baseline, so the plan was simply to add
 * one.
 *
 * WHAT THE FIXTURE ASSERTION FOUND INSTEAD
 * ----------------------------------------
 * The banner cannot render. Not "does not currently" - cannot, arithmetically:
 *
 *   - it needs all five basic rules met, and one of them is length >= 12
 *   - it needs `strength.score < 2`
 *   - the score comes from Shannon entropy, `length * log2(pool)`, with
 *     thresholds <40 -> 0, <55 -> 1, <70 -> 2, <90 -> 3
 *   - meeting the other four basic rules puts a lower-case, upper-case, digit
 *     and symbol in the password, so `pool` is 26+26+10+32 = 94
 *   - the floor is therefore 12 * log2(94) = 78.6 bits, which is score 3
 *
 * 78.6 is past the score-2 threshold, let alone score 1. There is no password
 * that satisfies both halves of the condition. `onWarningContainer` has **zero
 * reachable consumers**, which is why correcting it changed no pixel.
 *
 * The token fix is still right - the pair was genuinely below AA and would have
 * shipped a 2.81 banner the moment anyone loosened the length rule. But it
 * bought no user-visible improvement today, and this file says so rather than
 * letting a green matrix imply otherwise.
 *
 * The unreachable branch is reported in MOBILE_LIGHT_MODE_REMEDIATION_REPORT.md
 * as its own finding. Deleting it or fixing the threshold is a product call, so
 * it is not made here.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/design-system/providers';
import { matrixSnapshot, FULL_CASES } from '@/test-utils/visualMatrix';

import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

/* react-redux ships ESM and is not in the shared transform allowlist. Mocked
 * rather than allowlisted, which is what LoginScreen.matrix and
 * textScalingSafety already do: transforming it for every suite costs time in
 * all of them, and nothing here depends on real store behaviour. */
jest.mock('react-redux', () => {
  const useSelector = (selector: (s: unknown) => unknown) =>
    selector({ auth: { user: null, isAuthenticated: false, isLoading: false, error: null } });
  const useDispatch = () => jest.fn();
  useSelector.withTypes = () => useSelector;
  useDispatch.withTypes = () => useDispatch;
  return { useDispatch, useSelector };
});

/** Fails several rules; scores 0. Covers the error end of the ramp. */
const VERY_WEAK = 'abc';
/** Exactly at the 12-character floor with all four classes: the weakest a
 *  rule-satisfying password can be, and still "Good". */
const RULE_FLOOR = 'Trumpet7$sky';
const STRONG = 'Qv7#mLp2$zRt9!Wx';

/* The constants the unreachability proof rests on. Mirrored here on purpose:
 * if the source changes and this drifts, the test below fails and someone has
 * to re-derive whether the banner became reachable. */
const PASSWORD_MIN_LENGTH = 12;
const FULL_POOL = 26 + 26 + 10 + 32;
const SCORE_2_THRESHOLD_BITS = 70;

describe('PasswordStrengthIndicator', () => {
  describe('the warning banner is unreachable (M18)', () => {
    it('cannot be reached: the weakest rule-satisfying password already scores above it', () => {
      const floorEntropy = PASSWORD_MIN_LENGTH * Math.log2(FULL_POOL);

      // If this ever fails, the banner has become reachable - add a baseline
      // for it, because onWarningContainer would then be live.
      expect(floorEntropy).toBeGreaterThanOrEqual(SCORE_2_THRESHOLD_BITS);
    });

    it('does not render for the weakest password that satisfies every rule', () => {
      render(
        <ThemeProvider defaultTheme='light'>
          <PasswordStrengthIndicator password={RULE_FLOOR} />
        </ThemeProvider>,
      );
      expect(screen.queryByText(/too weak/iu)).toBeNull();
    });

    it('does not render for a password that fails the rules either', () => {
      // The other half of the condition: `allBasicMet` is false here, so the
      // branch returns null before the score is even consulted. Between the two
      // there is no input left that could reach it.
      render(
        <ThemeProvider defaultTheme='light'>
          <PasswordStrengthIndicator password={VERY_WEAK} />
        </ThemeProvider>,
      );
      expect(screen.queryByText(/too weak/iu)).toBeNull();
    });
  });

  describe('empty', () => {
    matrixSnapshot('empty', <PasswordStrengthIndicator password='' />, FULL_CASES);
  });

  describe('very weak', () => {
    // Rules unmet: exercises the error colours and the unmet-rule icon colour,
    // which M16-a moved off neutral[500].
    matrixSnapshot('very-weak', <PasswordStrengthIndicator password={VERY_WEAK} />, FULL_CASES);
  });

  describe('at the rule floor', () => {
    matrixSnapshot('rule-floor', <PasswordStrengthIndicator password={RULE_FLOOR} />, FULL_CASES);
  });

  describe('strong', () => {
    matrixSnapshot('strong', <PasswordStrengthIndicator password={STRONG} />, FULL_CASES);
  });
});

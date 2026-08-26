/**
 * Input baselines - added after the device audit, not before it.
 *
 * The device found the field rendering **white** on a dark card (finding D2):
 * `Input.styles.ts` set `backgroundColor: colors.base.neutral[0]` with the
 * comment "Pure white for better text visibility", which is a light-mode
 * statement written before there was a dark mode.
 *
 * No baseline caught it because the atom had none of its own. `Atoms.matrix`
 * covers `Input` only through a `testID`-tagged wrapper, and the field surface
 * was never in a baseline that crossed light and dark.
 *
 * These cover the states whose colour actually differs - resting, focused,
 * error, disabled - in both themes, so the field, its border, its label and its
 * placeholder are all pinned.
 */

import React from 'react';

import { matrixSnapshot, FULL_CASES } from '@/test-utils/visualMatrix';

import { Input } from './Input';

describe('Input', () => {
  describe('resting', () => {
    matrixSnapshot(
      'default',
      <Input testID='input' label='Email Address' placeholder='Enter your email' />,
      FULL_CASES,
    );
  });

  describe('error', () => {
    // Error border + helper text are their own colour pair in each theme.
    matrixSnapshot(
      'error',
      <Input
        testID='input'
        label='Email Address'
        placeholder='Enter your email'
        errorText='That address is not valid'
      />,
      FULL_CASES,
    );
  });

  describe('disabled', () => {
    matrixSnapshot(
      'disabled',
      <Input testID='input' label='Email Address' placeholder='Enter your email' disabled />,
      FULL_CASES,
    );
  });

  describe('filled variant', () => {
    // The only variant that was already theme-derived - included so a future
    // change cannot quietly bring it back in line with the broken ones.
    matrixSnapshot(
      'filled',
      <Input
        testID='input'
        label='Email Address'
        placeholder='Enter your email'
        variant='filled'
      />,
      FULL_CASES,
    );
  });
});

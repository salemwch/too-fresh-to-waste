/**
 * Design-system regression matrix for Button.
 *
 * Pins the resolved style of each variant across device size, theme and locale.
 * This is the gate that makes the token migration in
 * MOBILE_DESIGN_AUDIT_REPORT.md M1 safe to attempt: if a token change moves a
 * colour, a radius or a font size, the baseline says so.
 *
 * It is not a screenshot - see src/test-utils/visualMatrix.tsx.
 */

import React from 'react';

import { matrixSnapshot } from '@/test-utils/visualMatrix';

import { Button } from './Button';

matrixSnapshot(
  'Button / primary',
  <Button variant='primary' testID='btn'>
    Save
  </Button>,
);
matrixSnapshot(
  'Button / secondary',
  <Button variant='secondary' testID='btn'>
    Save
  </Button>,
);
matrixSnapshot(
  'Button / outline',
  <Button variant='outline' testID='btn'>
    Save
  </Button>,
);
matrixSnapshot(
  'Button / disabled',
  <Button variant='primary' disabled testID='btn'>
    Save
  </Button>,
);

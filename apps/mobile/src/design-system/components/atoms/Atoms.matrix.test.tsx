/**
 * Design-system regression matrix for the remaining atoms.
 *
 * Button has its own spec because it carries the most variants. These three are
 * grouped: together with Button they cover the surfaces, type and spacing that
 * the token migration in MOBILE_DESIGN_AUDIT_REPORT.md M1/M2 will move.
 *
 * Not a screenshot - see src/test-utils/visualMatrix.tsx.
 */

import React from 'react';

import { matrixSnapshot } from '@/test-utils/visualMatrix';

import { Badge } from './Badge';
import { Card } from './Card';
import { Input } from './Input';

matrixSnapshot(
  'Card / default',
  <Card testID='card'>
    <></>
  </Card>,
);
matrixSnapshot(
  'Card / elevated',
  <Card variant='elevated' testID='card'>
    <></>
  </Card>,
);

matrixSnapshot('Badge / default', <Badge label='NEW' testID='badge' />);
matrixSnapshot('Badge / success', <Badge label='PAID' variant='success' testID='badge' />);
matrixSnapshot('Badge / error', <Badge label='FAILED' variant='error' testID='badge' />);

matrixSnapshot('Input / default', <Input placeholder='Email' testID='input' />);
matrixSnapshot('Input / error', <Input placeholder='Email' error='Required' testID='input' />);

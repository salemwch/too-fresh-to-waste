/**
 * VoteBottomSheet — Stub placeholder
 *
 * Task 13 will replace this with the real implementation.
 * This file exists so VotingCard can import it without a type error.
 */

import React from 'react';

import type { PrizeOption } from '../types/voting.types';

export interface VoteBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  prizes: PrizeOption[];
  pointsSnapshot: number;
}

export const VoteBottomSheet: React.FC<VoteBottomSheetProps> = () => null;

VoteBottomSheet.displayName = 'VoteBottomSheet';

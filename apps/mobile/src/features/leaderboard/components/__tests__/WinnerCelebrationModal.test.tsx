/**
 * WinnerCelebrationModal — what it tells the winner they won.
 *
 * The prize used to be the literal string "Smartphone", which was only ever
 * right by accident: the catalogue is admin-defined per cycle and the community
 * votes on it. These tests exist so a scooter season cannot silently promise a
 * phone again.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { WinnerCelebrationModal } from '../WinnerCelebrationModal';

import en from '@/i18n/locales/en.json';

import type { PrizeClaimResponse } from '@foodwaste/shared';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return { Icon: () => mockReact.createElement(mockRN.Text, null, 'icon') };
});

/** Sourced from en.json so a renamed key fails here rather than silently. */
const L = en.leaderboard;

const claim = (over: Partial<PrizeClaimResponse> = {}): PrizeClaimResponse =>
  ({
    id: 'c1',
    userId: 'u1',
    prizeType: 'grand_prize',
    status: 'pending',
    rank: 1,
    totalPoints: 5000,
    cycleNumber: 1,
    createdAt: new Date().toISOString(),
    ...over,
  }) as PrizeClaimResponse;

const setup = (props: Partial<React.ComponentProps<typeof WinnerCelebrationModal>> = {}) =>
  render(
    <WinnerCelebrationModal
      visible
      onClose={jest.fn()}
      rank={1}
      hasClaimed={false}
      claimData={null}
      onClaim={jest.fn()}
      isClaiming={false}
      error={null}
      {...props}
    />,
  );

describe('WinnerCelebrationModal', () => {
  describe('naming the prize', () => {
    it('names the prize the community voted for', () => {
      const { getByText } = setup({ prizeName: 'Electric Scooter' });

      expect(getByText(L.youWonPrize.replace('{{prize}}', 'Electric Scooter'))).toBeTruthy();
    });

    it.each(['1 Year Gym + Protein', '5 Days in a Hotel', '1000 DNT Voucher', 'Smartphone'])(
      'works for %s',
      prize => {
        const { getByText } = setup({ prizeName: prize });

        expect(getByText(L.youWonPrize.replace('{{prize}}', prize))).toBeTruthy();
      },
    );

    // The name arrives from a separate request, so the first paint has nothing.
    it.each([undefined, null])('falls back to a generic phrase for %p', prizeName => {
      const { getByText } = setup({ ...(prizeName !== undefined ? { prizeName } : {}) });

      expect(getByText(L.youWonPrize.replace('{{prize}}', L.grandPrizeGeneric))).toBeTruthy();
    });

    /*
     * The claim is the record of what was actually awarded, so it outranks the
     * live cycle — an admin editing the catalogue must not change what an
     * already-claimed ticket says.
     */
    it('prefers the claimed prize over the current cycle prize', () => {
      const { getByText } = setup({
        hasClaimed: true,
        claimData: claim({ prizeName: 'Electric Scooter' }),
        prizeName: 'Something Else Entirely',
      });

      expect(getByText('Electric Scooter')).toBeTruthy();
    });

    it('falls back to the cycle prize when the claim did not record one', () => {
      const { getByText } = setup({
        hasClaimed: true,
        claimData: claim(),
        prizeName: 'Electric Scooter',
      });

      expect(getByText('Electric Scooter')).toBeTruthy();
    });
  });

  describe('the claimed ticket', () => {
    /*
     * The rank the ticket was awarded at, not the live one. They diverge once
     * the next season starts and points reset — the ticket is the record of
     * what happened, so it must not drift.
     */
    it('shows the rank the prize was awarded at', () => {
      const { getByText } = setup({
        hasClaimed: true,
        claimData: claim({ rank: 3 }),
        rank: 47,
      });

      expect(getByText(L.ticketRank.replace('{{rank}}', '3'))).toBeTruthy();
    });

    it.each([
      ['pending', L.statusPending],
      ['verified', L.statusVerified],
      ['delivered', L.statusDelivered],
    ])('translates the %s status', (status, label) => {
      const { getByText } = setup({
        hasClaimed: true,
        claimData: claim({ status: status as PrizeClaimResponse['status'] }),
      });

      expect(getByText(label)).toBeTruthy();
    });

    it('shows the winner name when there is one', () => {
      const { getByText } = setup({
        hasClaimed: true,
        claimData: claim(),
        firstName: 'Ahmed',
      });

      expect(getByText('Ahmed')).toBeTruthy();
    });
  });

  describe('before claiming', () => {
    it('congratulates the winner', () => {
      const { getByText } = setup();

      expect(getByText(L.congratulations)).toBeTruthy();
    });

    it('states the rank they finished at', () => {
      const { getByText } = setup({ rank: 2 });

      expect(getByText(L.finishedRank.replace('{{rank}}', '2'))).toBeTruthy();
    });

    it('surfaces an error to the user', () => {
      const { getByText } = setup({ error: 'The community did not reach its goal' });

      expect(getByText('The community did not reach its goal')).toBeTruthy();
    });
  });

  // No hardcoded English survives: every visible string above came from
  // en.json, so a missing key fails the suite rather than shipping untranslated.
  it('renders nothing when hidden', () => {
    const { queryByText } = setup({ visible: false });

    expect(queryByText(L.congratulations)).toBeNull();
  });
});

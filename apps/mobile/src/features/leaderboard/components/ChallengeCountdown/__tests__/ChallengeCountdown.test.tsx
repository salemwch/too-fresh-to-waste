/**
 * ChallengeCountdown.
 *
 * The reason this component exists is containment: the tick fires once a second,
 * and while the value lived on the screen it was a dependency of the ListHeader
 * useMemo — so every second rebuilt both prize cards, the section header and the
 * podium with its five FastImage avatars. The isolation test at the bottom is
 * the one that would catch that regressing.
 */

import { act, render } from '@testing-library/react-native';
import React from 'react';

import { ChallengeCountdown } from '../ChallengeCountdown';

const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const NOW = new Date('2026-07-26T12:00:00.000Z').getTime();
const inMs = (ms: number) => new Date(NOW + ms).toISOString();

describe('ChallengeCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('what it shows', () => {
    it('renders each unit with its label', () => {
      const { getByText } = render(
        <ChallengeCountdown endDate={inMs(2 * DAY + 3 * HOUR + 4 * MINUTE + 5 * SECOND)} />,
      );

      expect(getByText('DAYS')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
      expect(getByText('4')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
    });

    // A finished challenge has its own screen state; a row of zeros would lie.
    it('renders nothing once the challenge has ended', () => {
      expect(render(<ChallengeCountdown endDate={inMs(-SECOND)} />).toJSON()).toBeNull();
    });

    it('renders nothing without an end date', () => {
      expect(render(<ChallengeCountdown endDate={undefined} />).toJSON()).toBeNull();
    });
  });

  describe('ticking', () => {
    it('counts down once a second', () => {
      const { getByText } = render(<ChallengeCountdown endDate={inMs(10 * SECOND)} />);
      expect(getByText('10')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(3 * SECOND);
      });

      expect(getByText('7')).toBeTruthy();
    });

    it('disappears when the deadline passes while on screen', () => {
      const { toJSON } = render(<ChallengeCountdown endDate={inMs(2 * SECOND)} />);
      expect(toJSON()).not.toBeNull();

      act(() => {
        jest.advanceTimersByTime(3 * SECOND);
      });

      expect(toJSON()).toBeNull();
    });

    // A stale interval would keep calling setState on an unmounted tree.
    it('stops ticking after unmount', () => {
      const { unmount } = render(<ChallengeCountdown endDate={inMs(10 * SECOND)} />);
      unmount();

      expect(() =>
        act(() => {
          jest.advanceTimersByTime(5 * SECOND);
        }),
      ).not.toThrow();
      expect(jest.getTimerCount()).toBe(0);
    });

    // Without an immediate recompute the old value would linger for up to a
    // second after the challenge changed.
    it('updates immediately when the end date changes', () => {
      const { getByText, rerender } = render(<ChallengeCountdown endDate={inMs(5 * SECOND)} />);
      expect(getByText('5')).toBeTruthy();

      rerender(<ChallengeCountdown endDate={inMs(30 * SECOND)} />);

      expect(getByText('30')).toBeTruthy();
    });
  });

  // THE POINT OF THE COMPONENT. If the countdown state ever moves back up to the
  // screen, this fails: siblings would re-render on every tick.
  describe('render containment', () => {
    it('does not re-render its siblings when it ticks', () => {
      const siblingRender = jest.fn();
      const Sibling: React.FC = () => {
        siblingRender();
        return null;
      };

      render(
        <>
          <ChallengeCountdown endDate={inMs(60 * SECOND)} />
          <Sibling />
        </>,
      );
      const before = siblingRender.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(5 * SECOND);
      });

      expect(siblingRender).toHaveBeenCalledTimes(before);
    });
  });
});

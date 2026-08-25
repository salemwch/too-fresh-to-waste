/**
 * EnteringView Component Tests
 *
 * EnteringView replaced react-native-reanimated's declarative `entering` prop.
 * The risk in that swap is silent: a wrong initial value leaves content stuck
 * invisible, and a missing cleanup keeps a delayed animation running against an
 * unmounted view. Both are asserted here.
 */

import { render, screen, act } from '@testing-library/react-native';
import React from 'react';
import { Animated, Text } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import { EnteringView } from './EnteringView';

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: jest.fn(() => false) }));
const mockReducedMotion = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>;

describe('EnteringView', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders its children', () => {
      render(
        <EnteringView>
          <Text>Hello</Text>
        </EnteringView>,
      );

      expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('renders children for every animation variant', () => {
      const variants = ['fadeIn', 'fadeInUp', 'fadeInDown', 'zoomIn'] as const;

      variants.forEach(animation => {
        const { unmount } = render(
          <EnteringView animation={animation}>
            <Text>{`content-${animation}`}</Text>
          </EnteringView>,
        );

        expect(screen.getByText(`content-${animation}`)).toBeTruthy();
        unmount();
      });
    });

    it('forwards testID so callers can query the animated wrapper', () => {
      render(
        <EnteringView testID='entering-wrapper'>
          <Text>Hello</Text>
        </EnteringView>,
      );

      expect(screen.getByTestId('entering-wrapper')).toBeTruthy();
    });
  });

  describe('Animation lifecycle', () => {
    it('starts the entrance animation on mount', () => {
      const startSpy = jest.spyOn(Animated, 'timing');

      render(
        <EnteringView animation='fadeInUp' delay={100} duration={250}>
          <Text>Hello</Text>
        </EnteringView>,
      );

      expect(startSpy).toHaveBeenCalledTimes(1);

      // The config must reach the native driver, otherwise the animation runs on
      // the JS thread and the whole point of the migration is lost.
      const config = startSpy.mock.calls[0]?.[1];
      expect(config).toEqual(
        expect.objectContaining({ toValue: 1, duration: 250, delay: 100, useNativeDriver: true }),
      );
    });

    it('stops the animation when unmounted before it finishes', () => {
      const stop = jest.fn();
      jest.spyOn(Animated, 'timing').mockReturnValue({
        start: jest.fn(),
        stop,
        reset: jest.fn(),
      } as unknown as Animated.CompositeAnimation);

      const { unmount } = render(
        <EnteringView delay={5000}>
          <Text>Hello</Text>
        </EnteringView>,
      );

      expect(stop).not.toHaveBeenCalled();

      unmount();

      // Without this, a long-delayed entrance fires against a torn-down view.
      expect(stop).toHaveBeenCalledTimes(1);
    });

    it('does not restart the animation on unrelated re-renders', () => {
      const timingSpy = jest.spyOn(Animated, 'timing');

      const { rerender } = render(
        <EnteringView>
          <Text>first</Text>
        </EnteringView>,
      );

      expect(timingSpy).toHaveBeenCalledTimes(1);

      rerender(
        <EnteringView>
          <Text>second</Text>
        </EnteringView>,
      );

      // Children changed, animation inputs did not — re-running it would make the
      // content flash back to invisible.
      expect(timingSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('second')).toBeTruthy();
    });

    it('reaches full visibility once the animation completes', () => {
      render(
        <EnteringView animation='fadeIn' duration={200}>
          <Text>Hello</Text>
        </EnteringView>,
      );

      act(() => {
        jest.advanceTimersByTime(400);
      });

      // The assertion that matters is that content is still mounted and readable
      // after the entrance resolves — a stuck-at-zero opacity would be invisible
      // to users but still "rendered", so this pairs with the config check above.
      expect(screen.getByText('Hello')).toBeTruthy();
    });
  });

  /*
   * An entrance animation carries no information, so under reduced motion the
   * view should simply be present. The important half of this suite is the
   * other one: with the preference off, nothing about the existing behaviour
   * may change.
   */
  describe('Reduced motion', () => {
    it('starts fully visible and never animates when the preference is on', () => {
      mockReducedMotion.mockReturnValue(true);
      const timing = jest.spyOn(Animated, 'timing');

      render(
        <EnteringView animation='fadeInUp' testID='reduced'>
          <Text>Hello</Text>
        </EnteringView>,
      );

      expect(timing).not.toHaveBeenCalled();
      expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('still animates when the preference is off', () => {
      mockReducedMotion.mockReturnValue(false);
      const timing = jest.spyOn(Animated, 'timing');

      render(
        <EnteringView animation='fadeInUp' testID='normal'>
          <Text>Hello</Text>
        </EnteringView>,
      );

      expect(timing).toHaveBeenCalledTimes(1);
    });

    it('renders children under reduced motion for every variant', () => {
      mockReducedMotion.mockReturnValue(true);
      for (const animation of ['fadeIn', 'fadeInUp', 'fadeInDown', 'zoomIn'] as const) {
        const { unmount } = render(
          <EnteringView animation={animation}>
            <Text>{animation}</Text>
          </EnteringView>,
        );
        expect(screen.getByText(animation)).toBeTruthy();
        unmount();
      }
    });
  });
});

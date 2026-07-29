/**
 * MorphingButton Component Tests
 *
 * This component was migrated off react-native-reanimated with no existing
 * coverage. The cases below are the ones that can actually break in production:
 * the press guards (a double-submit on a payment/login form), the accessibility
 * state a screen-reader user hears, and the wave loop's lifecycle — an
 * Animated.loop that is never stopped keeps running after unmount.
 */

import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated } from 'react-native';
import { trigger as triggerHapticFeedback } from 'react-native-haptic-feedback';

import { ThemeProvider } from '../../../providers';

import { MorphingButton } from './MorphingButton';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const defaultProps = {
  label: 'Sign In',
  successLabel: 'Signed In',
  loading: false,
  success: false,
  onPress: jest.fn(),
};

const renderButton = (props: Partial<React.ComponentProps<typeof MorphingButton>> = {}) =>
  render(
    <TestWrapper>
      <MorphingButton {...defaultProps} testID='morphing-button' {...props} />
    </TestWrapper>,
  );

describe('MorphingButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the label', () => {
      renderButton();
      expect(screen.getByText('Sign In')).toBeTruthy();
    });

    it('renders with the provided testID', () => {
      renderButton();
      expect(screen.getByTestId('morphing-button')).toBeTruthy();
    });
  });

  describe('Press handling', () => {
    it('calls onPress when idle', () => {
      const onPress = jest.fn();
      renderButton({ onPress });

      fireEvent.press(screen.getByTestId('morphing-button'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('ignores presses while loading', () => {
      const onPress = jest.fn();
      renderButton({ onPress, loading: true });

      fireEvent.press(screen.getByTestId('morphing-button'));

      // Guards against double-submitting the form the button is attached to.
      expect(onPress).not.toHaveBeenCalled();
    });

    it('ignores presses once successful', () => {
      const onPress = jest.fn();
      renderButton({ onPress, success: true });

      fireEvent.press(screen.getByTestId('morphing-button'));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('ignores presses when disabled', () => {
      const onPress = jest.fn();
      renderButton({ onPress, disabled: true });

      fireEvent.press(screen.getByTestId('morphing-button'));

      expect(onPress).not.toHaveBeenCalled();
    });

    it('fires haptic feedback on an accepted press', () => {
      renderButton();

      fireEvent.press(screen.getByTestId('morphing-button'));

      expect(triggerHapticFeedback).toHaveBeenCalledWith('impactLight', expect.any(Object));
    });

    it('still calls onPress when haptic feedback throws', () => {
      // Haptics are unavailable on some devices/emulators; a throw there must not
      // swallow the user's tap.
      (triggerHapticFeedback as jest.Mock).mockImplementationOnce(() => {
        throw new Error('haptics unavailable');
      });
      const onPress = jest.fn();
      renderButton({ onPress });

      fireEvent.press(screen.getByTestId('morphing-button'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('announces the loading state', () => {
      renderButton({ loading: true });

      const button = screen.getByTestId('morphing-button');
      expect(button.props['accessibilityLabel']).toBe('Sign In, loading');
      expect(button.props['accessibilityState']).toEqual(
        expect.objectContaining({ busy: true, disabled: true }),
      );
    });

    it('announces the success label once successful', () => {
      renderButton({ success: true });

      expect(screen.getByTestId('morphing-button').props['accessibilityLabel']).toBe('Signed In');
    });

    it('announces the plain label and an enabled state when idle', () => {
      renderButton();

      const button = screen.getByTestId('morphing-button');
      expect(button.props['accessibilityLabel']).toBe('Sign In');
      expect(button.props['accessibilityState']).toEqual(
        expect.objectContaining({ busy: false, disabled: false }),
      );
    });
  });

  describe('Wave animation lifecycle', () => {
    it('does not spin the wave while idle', () => {
      const loopSpy = jest.spyOn(Animated, 'loop');
      renderButton();

      expect(loopSpy).not.toHaveBeenCalled();
    });

    it('spins the wave while loading', () => {
      const loopSpy = jest.spyOn(Animated, 'loop');
      renderButton({ loading: true });

      expect(loopSpy).toHaveBeenCalledTimes(1);
    });

    it('does not spin the wave when success arrives with loading still set', () => {
      const loopSpy = jest.spyOn(Animated, 'loop');
      // success wins over loading — reanimated cancelled the wave here, and the
      // replacement must too, or the checkmark sits on a still-spinning fill.
      renderButton({ loading: true, success: true });

      expect(loopSpy).not.toHaveBeenCalled();
    });

    it('stops the wave when loading ends', () => {
      const stop = jest.fn();
      jest
        .spyOn(Animated, 'loop')
        .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() } as unknown as ReturnType<
          typeof Animated.loop
        >);

      const { rerender } = renderButton({ loading: true });
      expect(stop).not.toHaveBeenCalled();

      rerender(
        <TestWrapper>
          <MorphingButton {...defaultProps} testID='morphing-button' loading={false} />
        </TestWrapper>,
      );

      expect(stop).toHaveBeenCalled();
    });

    it('stops the wave when unmounted mid-spin', () => {
      const stop = jest.fn();
      jest
        .spyOn(Animated, 'loop')
        .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() } as unknown as ReturnType<
          typeof Animated.loop
        >);

      const { unmount } = renderButton({ loading: true });
      unmount();

      // An un-stopped loop keeps driving a torn-down view forever.
      expect(stop).toHaveBeenCalled();
    });
  });
});

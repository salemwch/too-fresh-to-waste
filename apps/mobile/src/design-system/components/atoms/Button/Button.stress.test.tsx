/**
 * Button Component — Stress Tests
 *
 * Validates the Button component survives 500 rapid presses
 * both with and without pressGuardMs enabled.
 */

import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../providers';

import { Button } from './Button';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Button — Stress Tests', () => {
  it('survives 500 rapid presses without crashing (no guard)', () => {
    const onPress = jest.fn();

    render(
      <TestWrapper>
        <Button testID="stress-btn" onPress={onPress}>
          Tap Me
        </Button>
      </TestWrapper>,
    );

    const btn = screen.getByTestId('stress-btn');

    // Fire 500 presses synchronously — component must not throw
    for (let i = 0; i < 500; i++) {
      fireEvent.press(btn);
    }

    // Without guard: all 500 presses reach the handler
    expect(onPress).toHaveBeenCalledTimes(500);

    // Component is still mounted and visible
    expect(screen.getByText('Tap Me')).toBeTruthy();
  });

  it('with pressGuardMs=500, 500 synchronous presses → only 1 accepted', () => {
    const onPress = jest.fn();

    render(
      <TestWrapper>
        <Button testID="guarded-btn" onPress={onPress} pressGuardMs={500}>
          Guarded
        </Button>
      </TestWrapper>,
    );

    const btn = screen.getByTestId('guarded-btn');

    // Fire 500 presses at the same instant
    for (let i = 0; i < 500; i++) {
      fireEvent.press(btn);
    }

    // Guard blocks all but the first
    expect(onPress).toHaveBeenCalledTimes(1);

    // Component still renders correctly
    expect(screen.getByText('Guarded')).toBeTruthy();
  });

  it('with pressGuardMs=500, spaced presses over 60s → correct throttle rate', () => {
    const onPress = jest.fn();
    const cooldownMs = 500;

    render(
      <TestWrapper>
        <Button testID="timed-btn" onPress={onPress} pressGuardMs={cooldownMs}>
          Timed
        </Button>
      </TestWrapper>,
    );

    const btn = screen.getByTestId('timed-btn');
    const totalPresses = 500;
    const intervalMs = 120; // 60000ms / 500 = 120ms per press

    for (let i = 0; i < totalPresses; i++) {
      jest.advanceTimersByTime(intervalMs);
      fireEvent.press(btn);
    }

    // With 500ms cooldown and 120ms interval, one press is accepted per
    // ceil(500/120)=5 presses → 500/5 = 100. Fake timer discrete steps shift
    // boundaries, so we use a generous range.
    expect(onPress.mock.calls.length).toBeGreaterThanOrEqual(90);
    expect(onPress.mock.calls.length).toBeLessThanOrEqual(130);
    expect(onPress.mock.calls.length).toBeLessThan(totalPresses);
  });

  it('disabled button blocks all 500 presses regardless of guard', () => {
    const onPress = jest.fn();

    render(
      <TestWrapper>
        <Button testID="disabled-btn" onPress={onPress} disabled pressGuardMs={500}>
          Disabled
        </Button>
      </TestWrapper>,
    );

    const btn = screen.getByTestId('disabled-btn');

    for (let i = 0; i < 500; i++) {
      fireEvent.press(btn);
    }

    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading button blocks all 500 presses regardless of guard', () => {
    const onPress = jest.fn();

    render(
      <TestWrapper>
        <Button testID="loading-btn" onPress={onPress} loading pressGuardMs={500}>
          Loading
        </Button>
      </TestWrapper>,
    );

    const btn = screen.getByTestId('loading-btn');

    for (let i = 0; i < 500; i++) {
      fireEvent.press(btn);
    }

    expect(onPress).not.toHaveBeenCalled();
  });
});

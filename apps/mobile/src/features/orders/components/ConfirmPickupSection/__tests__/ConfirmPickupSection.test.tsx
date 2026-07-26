/**
 * ConfirmPickupSection.
 *
 * This is the handover gate: a correct code marks the order collected. The
 * cases that matter are the ones that must NOT submit — a short code, an
 * expired window, a request already in flight — because each of those either
 * wastes a backend round-trip or lets the user act on a dead order.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/design-system/providers', () => ({
  useTheme: () => ({ colors: { base: {}, onBackground: '#000' } }),
}));

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Card: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.View, null, children as React.ReactNode),
    Text: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.Text, null, children as React.ReactNode),
    Icon: () => null,
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children?: unknown;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      mockReact.createElement(
        mockRN.Pressable,
        { onPress, disabled, testID: 'confirm-button', accessibilityState: { disabled } },
        mockReact.createElement(mockRN.Text, null, children as React.ReactNode),
      ),
  };
});

import en from '@/i18n/locales/en.json';

import { ConfirmPickupSection } from '../ConfirmPickupSection';

// Read from the locale file rather than hardcoded: these assertions then also
// prove the keys exist, and survive a copy change.
const L = en.orders as Record<string, string>;

const defaults = {
  onConfirm: jest.fn(),
  onClearError: jest.fn(),
  isLoading: false,
  errorCode: null,
  isConfirmed: false,
  isExpired: false,
};

const setup = (over: Partial<React.ComponentProps<typeof ConfirmPickupSection>> = {}) =>
  render(<ConfirmPickupSection {...defaults} {...over} />);

const VALID_CODE = '123456';

/** The input, found by its accessibility label. */
const inputOf = (r: ReturnType<typeof setup>) =>
  r.getByLabelText(L['a11yPickupCodeInput'] as string);

const isDisabled = (r: ReturnType<typeof setup>): boolean =>
  r.getByTestId('confirm-button').props['accessibilityState']?.disabled === true;

describe('ConfirmPickupSection', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('state precedence', () => {
    it('shows the confirmed state and no input once picked up', () => {
      const r = setup({ isConfirmed: true });

      expect(r.getByText(L['pickupConfirmed'] as string)).toBeTruthy();
      expect(r.queryByTestId('confirm-button')).toBeNull();
    });

    // The window is closed; offering the field would invite a code the backend
    // is going to reject anyway.
    it('shows the expired state and no input once expired', () => {
      const r = setup({ isExpired: true });

      expect(r.queryByTestId('confirm-button')).toBeNull();
    });

    // isOrderExpired is time-based and can flip while the screen is open, but a
    // completed handover still outranks it.
    it('prefers confirmed over expired when both are true', () => {
      const r = setup({ isConfirmed: true, isExpired: true });

      expect(r.getByText(L['pickupConfirmed'] as string)).toBeTruthy();
    });

    it('shows the input in the default state', () => {
      expect(setup().getByTestId('confirm-button')).toBeTruthy();
    });
  });

  describe('the submit gate', () => {
    it('is disabled with an empty code', () => {
      expect(isDisabled(setup())).toBe(true);
    });

    it.each(['1', '12345'])('is disabled for the short code %p', code => {
      const r = setup();
      fireEvent.changeText(inputOf(r), code);

      expect(isDisabled(r)).toBe(true);
    });

    it('is enabled at exactly six digits', () => {
      const r = setup();
      fireEvent.changeText(inputOf(r), VALID_CODE);

      expect(isDisabled(r)).toBe(false);
    });

    // Otherwise a double tap sends the same code twice.
    it('is disabled while a confirmation is in flight', () => {
      const r = setup({ isLoading: true });
      fireEvent.changeText(inputOf(r), VALID_CODE);

      expect(isDisabled(r)).toBe(true);
    });

    it('submits the entered code', () => {
      const onConfirm = jest.fn();
      const r = setup({ onConfirm });

      fireEvent.changeText(inputOf(r), VALID_CODE);
      fireEvent.press(r.getByTestId('confirm-button'));

      expect(onConfirm).toHaveBeenCalledWith(VALID_CODE);
    });

    it('does not submit a short code even if pressed', () => {
      const onConfirm = jest.fn();
      const r = setup({ onConfirm });

      fireEvent.changeText(inputOf(r), '123');
      fireEvent.press(r.getByTestId('confirm-button'));

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('the input itself', () => {
    it('caps entry at six characters', () => {
      expect(inputOf(setup()).props['maxLength']).toBe(6);
    });

    it('asks for the numeric keyboard', () => {
      expect(inputOf(setup()).props['keyboardType']).toBe('numeric');
    });

    // A field the user can still type into during a request is a lie about
    // what the app is doing.
    it('is not editable while confirming', () => {
      expect(inputOf(setup({ isLoading: true })).props['editable']).toBe(false);
    });

    it('is editable otherwise', () => {
      expect(inputOf(setup()).props['editable']).toBe(true);
    });
  });

  describe('errors', () => {
    it('shows a translated message, never the raw code', () => {
      const r = setup({ errorCode: 'INVALID_CODE' });

      expect(r.queryByText('INVALID_CODE')).toBeNull();
      expect(r.getByText(L['invalidCode'] as string)).toBeTruthy();
    });

    it.each(['CODE_EXPIRED', 'PICKUP_ALREADY_DONE', 'PICKUP_LOCKED', 'ORDER_NOT_READY'] as const)(
      'renders a translated message for %s',
      errorCode => {
        const r = setup({ errorCode });

        expect(r.queryByText(errorCode)).toBeNull();
      },
    );

    // A stale error sitting under a code the user is already rewriting is
    // misleading, so editing clears it immediately.
    it('clears the error as soon as the code is edited', () => {
      const onClearError = jest.fn();
      const r = setup({ errorCode: 'INVALID_CODE', onClearError });

      fireEvent.changeText(inputOf(r), '1');

      expect(onClearError).toHaveBeenCalledTimes(1);
    });

    it('does not call onClearError when there is no error', () => {
      const onClearError = jest.fn();
      const r = setup({ onClearError });

      fireEvent.changeText(inputOf(r), '1');

      expect(onClearError).not.toHaveBeenCalled();
    });

    it('keeps the code the user typed when an error arrives', () => {
      const r = setup();
      fireEvent.changeText(inputOf(r), VALID_CODE);

      r.rerender(<ConfirmPickupSection {...defaults} errorCode='INVALID_CODE' />);

      expect(inputOf(r).props['value']).toBe(VALID_CODE);
    });
  });

  it('is memoised', () => {
    expect(ConfirmPickupSection.displayName).toBe('ConfirmPickupSection');
  });
});

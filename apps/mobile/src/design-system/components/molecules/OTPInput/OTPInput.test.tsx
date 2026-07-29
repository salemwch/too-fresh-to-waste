/**
 * OTPInput Component Tests
 *
 * Previously uncovered. Two areas matter here: the input logic users hit on
 * every verification (typing, pasting a code from an SMS, backspacing), and the
 * error shake, which was migrated off react-native-reanimated. The shake's
 * spring sequence must start only on error and must be stopped on unmount.
 */

import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated } from 'react-native';

import { ThemeProvider } from '../../../providers';

import { OTPInput } from './OTPInput';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

type OTPProps = React.ComponentProps<typeof OTPInput>;

/** OTPInput reads the palette through useTheme, so every render needs the provider. */
const withTheme = (props: Partial<OTPProps> & Pick<OTPProps, 'onChange'>) => (
  <TestWrapper>
    <OTPInput value='' {...props} />
  </TestWrapper>
);

const renderOTP = (props: Partial<React.ComponentProps<typeof OTPInput>> = {}) => {
  const onChange = jest.fn();
  const utils = render(withTheme({ onChange, ...props }));
  return { ...utils, onChange };
};

const digitInputs = () => screen.getAllByLabelText(/^Digit \d+ of \d+$/);

describe('OTPInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders six boxes by default', () => {
      renderOTP();
      expect(digitInputs()).toHaveLength(6);
    });

    it('honours a custom length', () => {
      renderOTP({ length: 4 });
      expect(digitInputs()).toHaveLength(4);
    });

    it('renders an empty value without crashing', () => {
      renderOTP({ value: '' });
      digitInputs().forEach(input => expect(input.props['value']).toBe(''));
    });

    it('spreads an existing value across the boxes', () => {
      renderOTP({ value: '123' });

      const inputs = digitInputs();
      expect(inputs[0]?.props['value']).toBe('1');
      expect(inputs[2]?.props['value']).toBe('3');
      // Positions beyond the value must be blank, not undefined-as-text.
      expect(inputs[3]?.props['value']).toBe('');
    });
  });

  describe('Entering a code', () => {
    it('reports a typed digit at its position', () => {
      const { onChange } = renderOTP({ value: '' });

      fireEvent.changeText(digitInputs()[0]!, '7');

      expect(onChange).toHaveBeenCalledWith('7');
    });

    it('keeps earlier digits when typing into a later box', () => {
      const { onChange } = renderOTP({ value: '12' });

      fireEvent.changeText(digitInputs()[2]!, '9');

      expect(onChange).toHaveBeenCalledWith('129');
    });

    it('accepts a pasted code', () => {
      const { onChange } = renderOTP({ value: '' });

      fireEvent.changeText(digitInputs()[0]!, '123456');

      expect(onChange).toHaveBeenCalledWith('123456');
    });

    it('truncates a pasted code longer than the input', () => {
      const { onChange } = renderOTP({ value: '', length: 6 });

      // SMS autofill can hand over more than the expected number of characters.
      fireEvent.changeText(digitInputs()[0]!, '1234567890');

      expect(onChange).toHaveBeenCalledWith('123456');
    });

    it('does not report changes while disabled', () => {
      const { onChange } = renderOTP({ disabled: true });

      digitInputs().forEach(input => expect(input.props['editable']).toBe(false));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('handles backspace on an empty box without throwing', () => {
      const { onChange } = renderOTP({ value: '1' });

      fireEvent(digitInputs()[1]!, 'keyPress', { nativeEvent: { key: 'Backspace' } });

      // Backspace on an empty box only moves focus; it must not emit a value.
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Error shake', () => {
    it('does not shake while there is no error', () => {
      const sequenceSpy = jest.spyOn(Animated, 'sequence');

      renderOTP({ error: false });

      expect(sequenceSpy).not.toHaveBeenCalled();
    });

    it('shakes when an error is present', () => {
      const sequenceSpy = jest.spyOn(Animated, 'sequence');

      renderOTP({ error: true });

      expect(sequenceSpy).toHaveBeenCalledTimes(1);
      // Five springs: left, right, left, right, settle.
      expect(sequenceSpy.mock.calls[0]?.[0]).toHaveLength(5);
    });

    it('shakes again when a later attempt also fails', () => {
      const sequenceSpy = jest.spyOn(Animated, 'sequence');

      const { rerender } = render(withTheme({ onChange: jest.fn(), error: false }));
      expect(sequenceSpy).not.toHaveBeenCalled();

      rerender(withTheme({ onChange: jest.fn(), error: true }));
      expect(sequenceSpy).toHaveBeenCalledTimes(1);

      rerender(withTheme({ onChange: jest.fn(), error: false }));
      rerender(withTheme({ onChange: jest.fn(), error: true }));

      // A second wrong code must visibly shake again, not stay still.
      expect(sequenceSpy).toHaveBeenCalledTimes(2);
    });

    it('stops the shake when unmounted mid-animation', () => {
      const stop = jest.fn();
      jest
        .spyOn(Animated, 'sequence')
        .mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() } as unknown as ReturnType<
          typeof Animated.sequence
        >);

      const { unmount } = renderOTP({ error: true });
      unmount();

      expect(stop).toHaveBeenCalled();
    });
  });
});

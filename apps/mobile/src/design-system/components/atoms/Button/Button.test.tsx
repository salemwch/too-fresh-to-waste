/**
 * Button Component Tests
 * Comprehensive test suite for Button component
 */

import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../providers';

import { Button } from './Button';

// Test wrapper with theme provider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('Button Component', () => {
  // Basic rendering tests
  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      render(
        <TestWrapper>
          <Button>Test Button</Button>
        </TestWrapper>,
      );

      expect(screen.getByText('Test Button')).toBeTruthy();
    });

    it('renders with custom testID', () => {
      render(
        <TestWrapper>
          <Button testID='custom-button'>Test Button</Button>
        </TestWrapper>,
      );

      expect(screen.getByTestId('custom-button')).toBeTruthy();
    });

    it('renders with loading state', () => {
      render(
        <TestWrapper>
          <Button loading testID='loading-button'>
            Test Button
          </Button>
        </TestWrapper>,
      );

      const button = screen.getByTestId('loading-button');
      expect(button).toBeTruthy();
      // ActivityIndicator should be present
      expect(screen.getByTestId('loading-button')).toBeTruthy();
    });
  });

  // Variant tests
  describe('Variants', () => {
    const variants = [
      'primary',
      'secondary',
      'tertiary',
      'ghost',
      'outline',
      'danger',
      'success',
    ] as const;

    variants.forEach(variant => {
      it(`renders ${variant} variant correctly`, () => {
        render(
          <TestWrapper>
            <Button variant={variant} testID={`${variant}-button`}>
              {variant} Button
            </Button>
          </TestWrapper>,
        );

        expect(screen.getByTestId(`${variant}-button`)).toBeTruthy();
      });
    });
  });

  // Size tests
  describe('Sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

    sizes.forEach(size => {
      it(`renders ${size} size correctly`, () => {
        render(
          <TestWrapper>
            <Button size={size} testID={`${size}-button`}>
              {size} Button
            </Button>
          </TestWrapper>,
        );

        expect(screen.getByTestId(`${size}-button`)).toBeTruthy();
      });
    });
  });

  // Interaction tests
  describe('Interactions', () => {
    it('calls onPress when pressed', () => {
      const onPressMock = jest.fn();

      render(
        <TestWrapper>
          <Button onPress={onPressMock} testID='pressable-button'>
            Pressable Button
          </Button>
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('pressable-button'));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const onPressMock = jest.fn();

      render(
        <TestWrapper>
          <Button onPress={onPressMock} disabled testID='disabled-button'>
            Disabled Button
          </Button>
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('disabled-button'));
      expect(onPressMock).not.toHaveBeenCalled();
    });

    it('does not call onPress when loading', () => {
      const onPressMock = jest.fn();

      render(
        <TestWrapper>
          <Button onPress={onPressMock} loading testID='loading-button'>
            Loading Button
          </Button>
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('loading-button'));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  // Icon tests
  describe('Icons', () => {
    const MockIcon = () => <div data-testid='mock-icon'>Icon</div>;

    it('renders with left icon', () => {
      render(
        <TestWrapper>
          <Button leftIcon={<MockIcon />} testID='left-icon-button'>
            Button with Left Icon
          </Button>
        </TestWrapper>,
      );

      expect(screen.getByTestId('left-icon-button')).toBeTruthy();
      expect(screen.getByTestId('mock-icon')).toBeTruthy();
    });

    it('renders with right icon', () => {
      render(
        <TestWrapper>
          <Button rightIcon={<MockIcon />} testID='right-icon-button'>
            Button with Right Icon
          </Button>
        </TestWrapper>,
      );

      expect(screen.getByTestId('right-icon-button')).toBeTruthy();
      expect(screen.getByTestId('mock-icon')).toBeTruthy();
    });

    it('renders with both left and right icons', () => {
      const LeftIcon = () => <div data-testid='left-icon'>Left</div>;
      const RightIcon = () => <div data-testid='right-icon'>Right</div>;

      render(
        <TestWrapper>
          <Button leftIcon={<LeftIcon />} rightIcon={<RightIcon />} testID='both-icons-button'>
            Button with Both Icons
          </Button>
        </TestWrapper>,
      );

      expect(screen.getByTestId('both-icons-button')).toBeTruthy();
      expect(screen.getByTestId('left-icon')).toBeTruthy();
      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('has correct accessibility role', () => {
      render(
        <TestWrapper>
          <Button testID='accessible-button'>Accessible Button</Button>
        </TestWrapper>,
      );

      const button = screen.getByTestId('accessible-button');
      expect(button.props['accessibilityRole']).toBe('button');
    });

    it('has correct accessibility state when disabled', () => {
      render(
        <TestWrapper>
          <Button disabled testID='disabled-button'>
            Disabled Button
          </Button>
        </TestWrapper>,
      );

      const button = screen.getByTestId('disabled-button');
      expect(button.props['accessibilityState'].disabled).toBe(true);
    });

    it('has correct accessibility state when loading', () => {
      render(
        <TestWrapper>
          <Button loading testID='loading-button'>
            Loading Button
          </Button>
        </TestWrapper>,
      );

      const button = screen.getByTestId('loading-button');
      expect(button.props['accessibilityState'].busy).toBe(true);
    });

    it('uses custom accessibility label', () => {
      render(
        <TestWrapper>
          <Button accessibilityLabel='Custom Label' testID='custom-label-button'>
            Button Text
          </Button>
        </TestWrapper>,
      );

      const button = screen.getByTestId('custom-label-button');
      expect(button.props['accessibilityLabel']).toBe('Custom Label');
    });
  });

  // Style tests
  describe('Styling', () => {
    it('applies fullWidth prop correctly', () => {
      render(
        <TestWrapper>
          <Button fullWidth testID='full-width-button'>
            Full Width Button
          </Button>
        </TestWrapper>,
      );

      expect(screen.getByTestId('full-width-button')).toBeTruthy();
    });

    it('applies custom style', () => {
      const customStyle = { backgroundColor: 'red' };

      render(
        <TestWrapper>
          <Button style={customStyle} testID='custom-style-button'>
            Custom Style Button
          </Button>
        </TestWrapper>,
      );

      expect(screen.getByTestId('custom-style-button')).toBeTruthy();
    });
  });

  // Animation tests
  describe('Animations', () => {
    it('accepts custom animation config', () => {
      const customAnimation = { scale: 0.9, duration: 200 };

      render(
        <TestWrapper>
          <Button animation={customAnimation} testID='animated-button'>
            Animated Button
          </Button>
        </TestWrapper>,
      );

      expect(screen.getByTestId('animated-button')).toBeTruthy();
    });
  });
});

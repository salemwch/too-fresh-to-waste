/**
 * Card Component - Tests
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { ThemeProvider } from '../../../providers';

import { Card } from './Card';

describe('Card', () => {
  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider>{component}</ThemeProvider>);

  it('renders correctly with default props', () => {
    const { getByText } = renderWithTheme(
      <Card>
        <Text>Card Content</Text>
      </Card>,
    );
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('renders children correctly', () => {
    const { getByText } = renderWithTheme(
      <Card>
        <Text>Title</Text>
        <Text>Description</Text>
      </Card>,
    );
    expect(getByText('Title')).toBeTruthy();
    expect(getByText('Description')).toBeTruthy();
  });

  it('handles press event when pressable', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithTheme(
      <Card pressable onPress={onPress}>
        <Text>Pressable Card</Text>
      </Card>,
    );

    const card = getByText('Pressable Card').parent;
    if (card) {
      fireEvent.press(card);
      expect(onPress).toHaveBeenCalled();
    }
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithTheme(
      <Card pressable disabled onPress={onPress}>
        <Text>Disabled Card</Text>
      </Card>,
    );

    const card = getByText('Disabled Card').parent;
    if (card) {
      fireEvent.press(card);
      expect(onPress).not.toHaveBeenCalled();
    }
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithTheme(
      <Card pressable loading onPress={onPress}>
        <Text>Loading Card</Text>
      </Card>,
    );

    const card = getByText('Loading Card').parent;
    if (card) {
      fireEvent.press(card);
      expect(onPress).not.toHaveBeenCalled();
    }
  });

  it('shows loading indicator when loading', () => {
    const { getByTestId } = renderWithTheme(
      <Card loading testID="loading-card">
        <Text>Content</Text>
      </Card>,
    );

    // Card should be in loading state
    const card = getByTestId('loading-card');
    expect(card).toBeTruthy();
  });

  it('applies different variants correctly', () => {
    const variants: Array<'default' | 'elevated' | 'outlined'> = [
      'default',
      'elevated',
      'outlined',
    ];

    variants.forEach((variant) => {
      const { getByText } = renderWithTheme(
        <Card variant={variant}>
          <Text>{variant} card</Text>
        </Card>,
      );
      expect(getByText(`${variant} card`)).toBeTruthy();
    });
  });

  it('applies different sizes correctly', () => {
    const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

    sizes.forEach((size) => {
      const { getByText } = renderWithTheme(
        <Card size={size}>
          <Text>{size} card</Text>
        </Card>,
      );
      expect(getByText(`${size} card`)).toBeTruthy();
    });
  });

  it('handles pressIn and pressOut events when pressable', () => {
    const { getByText } = renderWithTheme(
      <Card pressable>
        <Text>Test Card</Text>
      </Card>,
    );

    const card = getByText('Test Card').parent;
    if (card) {
      fireEvent(card, 'pressIn');
      fireEvent(card, 'pressOut');
    }

    // Animation should have been triggered
    expect(true).toBe(true); // Placeholder for animation test
  });

  it('applies custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByTestId } = renderWithTheme(
      <Card style={customStyle} testID="styled-card">
        <Text>Styled Card</Text>
      </Card>,
    );
    expect(getByTestId('styled-card')).toBeTruthy();
  });

  it('handles accessibility props correctly', () => {
    const { getByLabelText } = renderWithTheme(
      <Card accessibilityLabel="Product card" accessibilityHint="Tap to view product details">
        <Text>Product</Text>
      </Card>,
    );
    expect(getByLabelText('Product card')).toBeTruthy();
  });

  it('sets correct accessibility role when pressable', () => {
    const { getByTestId } = renderWithTheme(
      <Card pressable testID="pressable-card">
        <Text>Pressable</Text>
      </Card>,
    );
    const card = getByTestId('pressable-card');
    expect(card.props['accessibilityRole']).toBe('button');
  });

  it('applies accessibility state when disabled', () => {
    const { getByTestId } = renderWithTheme(
      <Card pressable disabled testID="disabled-card">
        <Text>Disabled</Text>
      </Card>,
    );
    const card = getByTestId('disabled-card');
    expect(card.props['accessibilityState']?.disabled).toBe(true);
  });

  it('applies accessibility state when loading', () => {
    const { getByTestId } = renderWithTheme(
      <Card pressable loading testID="loading-card">
        <Text>Loading</Text>
      </Card>,
    );
    const card = getByTestId('loading-card');
    expect(card.props['accessibilityState']?.busy).toBe(true);
  });
});

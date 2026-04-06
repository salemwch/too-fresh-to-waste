/**
 * Badge Component - Tests
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemeProvider } from '../../../providers';
import { Icon } from '../Icon';

import { Badge } from './Badge';

describe('Badge', () => {
  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider>{component}</ThemeProvider>);
  const getFlattenedStyle = (element: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(element.props['style']);

  it('renders correctly with default props', () => {
    const { getByText } = renderWithTheme(<Badge label='Badge' />);
    expect(getByText('Badge')).toBeTruthy();
  });

  it('renders with text label', () => {
    const { getByText } = renderWithTheme(<Badge label='New' />);
    expect(getByText('New')).toBeTruthy();
  });

  it('renders with number label', () => {
    const { getByText } = renderWithTheme(<Badge label={5} />);
    expect(getByText('5')).toBeTruthy();
  });

  it('renders as dot badge', () => {
    const { getByTestId, queryByText } = renderWithTheme(
      <Badge dot label='Hidden' testID='dot-badge' />,
    );
    expect(getByTestId('dot-badge')).toBeTruthy();
    expect(queryByText('Hidden')).toBeNull();
  });

  it('renders with different variants', () => {
    const variants: Array<
      'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'neutral'
    > = ['default', 'primary', 'secondary', 'success', 'error', 'warning', 'info', 'neutral'];

    variants.forEach(variant => {
      const { getByText } = renderWithTheme(<Badge label={variant} variant={variant} />);
      expect(getByText(variant)).toBeTruthy();
    });
  });

  it('renders with different sizes', () => {
    const sizes: Array<'xs' | 'sm' | 'md' | 'lg' | 'xl'> = ['xs', 'sm', 'md', 'lg', 'xl'];

    sizes.forEach(size => {
      const { getByText } = renderWithTheme(<Badge label={size} size={size} />);
      expect(getByText(size)).toBeTruthy();
    });
  });

  it('renders with outlined style', () => {
    const { getByText } = renderWithTheme(<Badge label='Outlined' outlined />);
    expect(getByText('Outlined')).toBeTruthy();
  });

  it('renders with left icon', () => {
    const { getByText, getByTestId } = renderWithTheme(
      <Badge label='Icon Badge' leftIcon={<Icon name='star' testID='left-icon' />} />,
    );
    expect(getByText('Icon Badge')).toBeTruthy();
    expect(getByTestId('left-icon')).toBeTruthy();
  });

  it('renders with right icon', () => {
    const { getByText, getByTestId } = renderWithTheme(
      <Badge label='Icon Badge' rightIcon={<Icon name='arrow-forward' testID='right-icon' />} />,
    );
    expect(getByText('Icon Badge')).toBeTruthy();
    expect(getByTestId('right-icon')).toBeTruthy();
  });

  it('renders with close button when closable', () => {
    const onClose = jest.fn();
    const { getByLabelText } = renderWithTheme(
      <Badge label='Closable' closable onClose={onClose} />,
    );

    const closeButton = getByLabelText('Remove badge');
    expect(closeButton).toBeTruthy();

    fireEvent.press(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('handles press event when pressable', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithTheme(<Badge label='Pressable' pressable onPress={onPress} />);

    const badge = getByText('Pressable');
    fireEvent.press(badge);
    expect(onPress).toHaveBeenCalled();
  });

  it('renders with custom background color', () => {
    const { getByTestId } = renderWithTheme(
      <Badge label='Custom' backgroundColor='#FF5722' testID='custom-badge' />,
    );
    expect(getByTestId('custom-badge')).toBeTruthy();
  });

  it('renders with custom text color', () => {
    const { getByText } = renderWithTheme(<Badge label='Colored' color='#FFFFFF' />);
    const text = getByText('Colored');
    expect(getFlattenedStyle(text)).toMatchObject(expect.objectContaining({ color: '#FFFFFF' }));
  });

  it('renders with custom border color when outlined', () => {
    const { getByTestId } = renderWithTheme(
      <Badge label='Bordered' outlined borderColor='#2196F3' testID='bordered-badge' />,
    );
    expect(getByTestId('bordered-badge')).toBeTruthy();
  });

  it('applies custom style', () => {
    const customStyle = { marginTop: 10 };
    const { getByTestId } = renderWithTheme(
      <Badge label='Styled' style={customStyle} testID='styled-badge' />,
    );
    expect(getByTestId('styled-badge')).toBeTruthy();
  });

  it('applies custom text style', () => {
    const customTextStyle = { fontSize: 20 };
    const { getByText } = renderWithTheme(<Badge label='Text' textStyle={customTextStyle} />);
    const text = getByText('Text');
    expect(getFlattenedStyle(text)).toMatchObject(expect.objectContaining({ fontSize: 20 }));
  });

  it('handles accessibility props', () => {
    const { getByLabelText } = renderWithTheme(
      <Badge
        label='Badge'
        accessibilityLabel='Status badge'
        accessibilityHint='Shows notification count'
      />,
    );
    expect(getByLabelText('Status badge')).toBeTruthy();
  });

  it('uses label as default accessibility label', () => {
    const { getAllByLabelText } = renderWithTheme(<Badge label='Default Label' />);
    expect(getAllByLabelText('Default Label').length).toBeGreaterThan(0);
  });

  it('converts number label to string for accessibility', () => {
    const { getAllByLabelText } = renderWithTheme(<Badge label={42} />);
    expect(getAllByLabelText('42').length).toBeGreaterThan(0);
  });

  it('sets correct accessibility role when pressable', () => {
    const { getByTestId } = renderWithTheme(
      <Badge label='Pressable' pressable onPress={() => {}} testID='pressable-badge' />,
    );
    const badge = getByTestId('pressable-badge');
    expect(badge.props['accessibilityRole']).toBe('button');
  });

  it('sets correct accessibility role when not pressable', () => {
    const { getByTestId } = renderWithTheme(<Badge label='Text' testID='text-badge' />);
    const badge = getByTestId('text-badge');
    expect(badge.props['accessibilityRole']).toBe('text');
  });

  it('renders with both icons and close button', () => {
    const onClose = jest.fn();
    const { getByText, getByTestId, getByLabelText } = renderWithTheme(
      <Badge
        label='Full'
        leftIcon={<Icon name='star' testID='left-icon' />}
        rightIcon={<Icon name='verified' testID='right-icon' />}
        closable
        onClose={onClose}
      />,
    );

    expect(getByText('Full')).toBeTruthy();
    expect(getByTestId('left-icon')).toBeTruthy();
    expect(getByTestId('right-icon')).toBeTruthy();
    expect(getByLabelText('Remove badge')).toBeTruthy();
  });
});

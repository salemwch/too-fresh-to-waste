/**
 * Avatar Component - Tests
 */

import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet } from 'react-native';

import { ThemeProvider } from '../../../providers';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider>{component}</ThemeProvider>);
  const getFlattenedStyle = (element: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(element.props['style']);

  it('renders correctly with default props', () => {
    const { getByTestId } = renderWithTheme(<Avatar testID='avatar' />);
    expect(getByTestId('avatar')).toBeTruthy();
  });

  it('renders with initials', () => {
    const { getByText } = renderWithTheme(<Avatar initials='JD' />);
    expect(getByText('JD')).toBeTruthy();
  });

  it('renders with truncated initials (max 2 characters)', () => {
    const { getByText } = renderWithTheme(<Avatar initials='JOHN' />);
    expect(getByText('JO')).toBeTruthy();
  });

  it('renders with image URI', () => {
    const { getByTestId } = renderWithTheme(
      <Avatar uri='https://example.com/avatar.jpg' testID='image-avatar' />,
    );
    expect(getByTestId('image-avatar')).toBeTruthy();
  });

  it('renders with different sizes', () => {
    const sizes: Array<'xs' | 'sm' | 'md' | 'lg' | 'xl'> = ['xs', 'sm', 'md', 'lg', 'xl'];

    sizes.forEach(size => {
      const { getByTestId } = renderWithTheme(
        <Avatar size={size} initials={size.toUpperCase()} testID={`avatar-${size}`} />,
      );
      expect(getByTestId(`avatar-${size}`)).toBeTruthy();
    });
  });

  it('renders with custom size number', () => {
    const { getByTestId } = renderWithTheme(
      <Avatar size={100} initials='AB' testID='custom-size' />,
    );
    expect(getByTestId('custom-size')).toBeTruthy();
  });

  it('renders with different variants', () => {
    const variants: Array<'circular' | 'rounded' | 'square'> = ['circular', 'rounded', 'square'];

    variants.forEach(variant => {
      const { getByTestId } = renderWithTheme(
        <Avatar variant={variant} initials='AB' testID={`avatar-${variant}`} />,
      );
      expect(getByTestId(`avatar-${variant}`)).toBeTruthy();
    });
  });

  it('renders with custom background color', () => {
    const { getByTestId } = renderWithTheme(
      <Avatar backgroundColor='#FF5722' initials='AB' testID='colored-avatar' />,
    );
    expect(getByTestId('colored-avatar')).toBeTruthy();
  });

  it('renders with custom text color', () => {
    const { getByText } = renderWithTheme(<Avatar initials='CD' color='#FFFFFF' />);
    const text = getByText('CD');
    expect(getFlattenedStyle(text)).toMatchObject(expect.objectContaining({ color: '#FFFFFF' }));
  });

  it('renders with border', () => {
    const { getByTestId } = renderWithTheme(
      <Avatar initials='EF' borderColor='#2196F3' borderWidth={2} testID='bordered-avatar' />,
    );
    expect(getByTestId('bordered-avatar')).toBeTruthy();
  });

  it('renders with status indicator', () => {
    const { getByTestId } = renderWithTheme(
      <Avatar initials='GH' showStatus status='online' testID='status-avatar' />,
    );
    expect(getByTestId('status-avatar')).toBeTruthy();
  });

  it('renders different status types', () => {
    const statuses: Array<'online' | 'offline' | 'away' | 'busy'> = [
      'online',
      'offline',
      'away',
      'busy',
    ];

    statuses.forEach(status => {
      const { getByTestId } = renderWithTheme(
        <Avatar initials='IJ' showStatus status={status} testID={`avatar-${status}`} />,
      );
      expect(getByTestId(`avatar-${status}`)).toBeTruthy();
    });
  });

  it('renders with custom icon', () => {
    const { getByTestId } = renderWithTheme(<Avatar iconName='star' testID='icon-avatar' />);
    expect(getByTestId('icon-avatar')).toBeTruthy();
  });

  it('handles press event when pressable', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithTheme(
      <Avatar initials='KL' pressable onPress={onPress} testID='pressable-avatar' />,
    );

    const avatar = getByTestId('pressable-avatar');
    fireEvent.press(avatar);
    expect(onPress).toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    const { UNSAFE_getByType } = renderWithTheme(<Avatar initials='MN' loading />);

    expect(() => UNSAFE_getByType(ActivityIndicator)).not.toThrow();
  });

  it('falls back to initials when image fails to load', () => {
    const { getByText, UNSAFE_getByType } = renderWithTheme(
      <Avatar uri='https://invalid-url.com/avatar.jpg' initials='OP' />,
    );

    const onError = UNSAFE_getByType(Image).props['onError'] as (() => void) | undefined;

    expect(onError).toBeDefined();

    if (onError) {
      act(() => {
        onError();
      });
    }

    expect(getByText('OP')).toBeTruthy();
  });

  it('applies custom style', () => {
    const customStyle = { marginTop: 20 };
    const { getByTestId } = renderWithTheme(
      <Avatar initials='QR' style={customStyle} testID='styled-avatar' />,
    );
    expect(getByTestId('styled-avatar')).toBeTruthy();
  });

  it('handles accessibility props', () => {
    const { getByLabelText } = renderWithTheme(
      <Avatar
        initials='ST'
        accessibilityLabel='User avatar'
        accessibilityHint='View user profile'
      />,
    );
    expect(getByLabelText('User avatar')).toBeTruthy();
  });

  it('sets correct accessibility role when pressable', () => {
    const { getByTestId } = renderWithTheme(
      <Avatar initials='UV' pressable onPress={() => {}} testID='pressable-avatar' />,
    );
    const avatar = getByTestId('pressable-avatar');
    expect(avatar.props['accessibilityRole']).toBe('button');
  });

  it('sets correct accessibility role when not pressable', () => {
    const { getByTestId } = renderWithTheme(<Avatar initials='WX' testID='image-avatar' />);
    const avatar = getByTestId('image-avatar');
    expect(avatar.props['accessibilityRole']).toBe('image');
  });
});

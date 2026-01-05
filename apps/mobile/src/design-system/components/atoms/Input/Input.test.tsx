/**
 * Input Component - Tests
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import { ThemeProvider } from '../../../providers';

import { Input } from './Input';

describe('Input', () => {
  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider>{component}</ThemeProvider>);

  it('renders correctly with default props', () => {
    const { getByPlaceholderText } = renderWithTheme(<Input placeholder='Enter text' />);
    expect(getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('renders with label', () => {
    const { getByText } = renderWithTheme(<Input label='Username' placeholder='Enter username' />);
    expect(getByText('Username')).toBeTruthy();
  });

  it('renders required asterisk when required', () => {
    const { getByText } = renderWithTheme(<Input label='Email' required />);
    expect(getByText('*')).toBeTruthy();
  });

  it('renders helper text', () => {
    const { getByText } = renderWithTheme(
      <Input label='Password' helperText='Must be at least 8 characters' />,
    );
    expect(getByText('Must be at least 8 characters')).toBeTruthy();
  });

  it('renders error text and overrides helper text', () => {
    const { getByText, queryByText } = renderWithTheme(
      <Input
        label='Email'
        helperText='Enter your email'
        errorText='Invalid email format'
        hasError
      />,
    );
    expect(getByText('Invalid email format')).toBeTruthy();
    expect(queryByText('Enter your email')).toBeNull();
  });

  it('renders left icon', () => {
    const { getByTestId } = renderWithTheme(
      <Input placeholder='Search' leftIcon={<View testID='search-icon' />} />,
    );
    expect(getByTestId('search-icon')).toBeTruthy();
  });

  it('renders right icon', () => {
    const { getByTestId } = renderWithTheme(
      <Input placeholder='Password' rightIcon={<View testID='eye-icon' />} />,
    );
    expect(getByTestId('eye-icon')).toBeTruthy();
  });

  it('handles focus events', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const onFocusChange = jest.fn();

    const { getByPlaceholderText } = renderWithTheme(
      <Input placeholder='Test' onFocus={onFocus} onBlur={onBlur} onFocusChange={onFocusChange} />,
    );

    const input = getByPlaceholderText('Test');
    fireEvent(input, 'focus');
    expect(onFocus).toHaveBeenCalled();
    expect(onFocusChange).toHaveBeenCalledWith(true);

    fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalled();
    expect(onFocusChange).toHaveBeenCalledWith(false);
  });

  it('disables input when disabled prop is true', () => {
    const { getByPlaceholderText } = renderWithTheme(<Input placeholder='Test' disabled />);
    const input = getByPlaceholderText('Test');
    expect(input.props['editable']).toBe(false);
  });

  it('makes input read-only when readOnly prop is true', () => {
    const { getByPlaceholderText } = renderWithTheme(<Input placeholder='Test' readOnly />);
    const input = getByPlaceholderText('Test');
    expect(input.props['editable']).toBe(false);
  });

  it('applies different variants correctly', () => {
    const variants: Array<'default' | 'filled' | 'outlined'> = ['default', 'filled', 'outlined'];

    variants.forEach(variant => {
      const { getByPlaceholderText } = renderWithTheme(
        <Input placeholder={`${variant} input`} variant={variant} />,
      );
      expect(getByPlaceholderText(`${variant} input`)).toBeTruthy();
    });
  });

  it('applies different sizes correctly', () => {
    const sizes: Array<'xs' | 'sm' | 'md' | 'lg' | 'xl'> = ['xs', 'sm', 'md', 'lg', 'xl'];

    sizes.forEach(size => {
      const { getByPlaceholderText } = renderWithTheme(
        <Input placeholder={`${size} input`} size={size} />,
      );
      expect(getByPlaceholderText(`${size} input`)).toBeTruthy();
    });
  });

  it('applies fullWidth correctly', () => {
    const { getByTestId } = renderWithTheme(
      <Input placeholder='Test' fullWidth testID='full-width-input' />,
    );
    expect(getByTestId('full-width-input')).toBeTruthy();
  });

  it('handles text changes', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = renderWithTheme(
      <Input placeholder='Test' onChangeText={onChangeText} />,
    );

    const input = getByPlaceholderText('Test');
    fireEvent.changeText(input, 'Hello');
    expect(onChangeText).toHaveBeenCalledWith('Hello');
  });

  it('handles accessibility props', () => {
    const { getByLabelText } = renderWithTheme(
      <Input
        placeholder='Test'
        accessibilityLabel='Test input field'
        accessibilityHint='Enter your text here'
      />,
    );
    expect(getByLabelText('Test input field')).toBeTruthy();
  });
});

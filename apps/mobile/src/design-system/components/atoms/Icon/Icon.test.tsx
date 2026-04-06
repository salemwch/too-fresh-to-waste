/**
 * Icon Component - Tests
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../providers';

import { Icon } from './Icon';

describe('Icon', () => {
  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider>{component}</ThemeProvider>);

  it('renders correctly with default props', () => {
    const { getByLabelText } = renderWithTheme(<Icon name='home' />);
    expect(getByLabelText('home')).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { getByLabelText } = renderWithTheme(<Icon name='star' size={32} />);
    expect(getByLabelText('star')).toBeTruthy();
  });

  it('renders with different size presets', () => {
    const sizes: Array<'xs' | 'sm' | 'md' | 'lg' | 'xl'> = ['xs', 'sm', 'md', 'lg', 'xl'];

    sizes.forEach(size => {
      const { getByLabelText } = renderWithTheme(<Icon name={`${size}-icon`} size={size} />);
      expect(getByLabelText(`${size}-icon`)).toBeTruthy();
    });
  });

  it('renders with custom color', () => {
    const { getByLabelText } = renderWithTheme(<Icon name='favorite' color='#FF0000' />);
    expect(getByLabelText('favorite')).toBeTruthy();
  });

  it('renders with background color', () => {
    const { getByLabelText } = renderWithTheme(<Icon name='check' backgroundColor='#005250' />);
    expect(getByLabelText('check')).toBeTruthy();
  });

  it('renders with custom border radius', () => {
    const { getByLabelText } = renderWithTheme(
      <Icon name='circle' backgroundColor='#2196F3' borderRadius={8} />,
    );
    expect(getByLabelText('circle')).toBeTruthy();
  });

  it('renders with custom padding', () => {
    const { getByLabelText } = renderWithTheme(
      <Icon name='add' backgroundColor='#FFC107' padding={16} />,
    );
    expect(getByLabelText('add')).toBeTruthy();
  });

  it('handles disabled state', () => {
    const { getByLabelText } = renderWithTheme(<Icon name='lock' disabled />);
    const iconContainer = getByLabelText('lock');
    expect(iconContainer).toBeTruthy();
  });

  it('renders with different icon families', () => {
    const families: Array<
      'MaterialIcons' | 'MaterialCommunityIcons' | 'FontAwesome' | 'Ionicons' | 'Feather'
    > = ['MaterialIcons', 'MaterialCommunityIcons', 'FontAwesome', 'Ionicons', 'Feather'];

    families.forEach(family => {
      const { getByLabelText } = renderWithTheme(<Icon name='home' family={family} />);
      expect(getByLabelText('home')).toBeTruthy();
    });
  });

  it('applies custom style', () => {
    const customStyle = { marginTop: 10 };
    const { getByLabelText } = renderWithTheme(<Icon name='settings' style={customStyle} />);
    expect(getByLabelText('settings')).toBeTruthy();
  });

  it('applies custom container style', () => {
    const customContainerStyle = { marginBottom: 20 };
    const { getByLabelText } = renderWithTheme(
      <Icon name='menu' containerStyle={customContainerStyle} />,
    );
    expect(getByLabelText('menu')).toBeTruthy();
  });

  it('handles accessibility props', () => {
    const { getByLabelText } = renderWithTheme(
      <Icon
        name='info'
        accessibilityLabel='Information icon'
        accessibilityHint='Shows additional information'
        accessibilityRole='button'
      />,
    );
    expect(getByLabelText('Information icon')).toBeTruthy();
  });

  it('uses icon name as default accessibility label', () => {
    const { getByLabelText } = renderWithTheme(<Icon name='search' />);
    expect(getByLabelText('search')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = renderWithTheme(<Icon name='close' testID='close-icon' />);
    expect(getByTestId('close-icon')).toBeTruthy();
  });
});

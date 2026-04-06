/**
 * Text Component - Tests
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemeProvider } from '../../../providers';

import { Text } from './Text';

import type { TextProps } from './Text.types';
import type { TypographyVariant } from '../../../types';

describe('Text', () => {
  const renderWithTheme = (component: React.ReactElement) =>
    render(<ThemeProvider>{component}</ThemeProvider>);
  const getFlattenedStyle = (element: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(element.props['style']);

  it('renders correctly with default props', () => {
    const { getByText } = renderWithTheme(<Text>Hello World</Text>);
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders with different variants', () => {
    const variants = [
      'display.large',
      'display.medium',
      'display.small',
      'headline.large',
      'headline.medium',
      'headline.small',
      'title.large',
      'title.medium',
      'title.small',
      'body.large',
      'body.medium',
      'body.small',
      'label.large',
      'label.medium',
      'label.small',
    ];

    variants.forEach((variant) => {
      const { getByText } = renderWithTheme(
        <Text variant={variant as TypographyVariant}>{variant}</Text>,
      );
      expect(getByText(variant)).toBeTruthy();
    });
  });

  it('applies color prop correctly', () => {
    const { getByText } = renderWithTheme(<Text color="#FF0000">Red Text</Text>);
    const textElement = getByText('Red Text');
    expect(getFlattenedStyle(textElement)).toMatchObject(
      expect.objectContaining({ color: '#FF0000' }),
    );
  });

  it('applies text alignment', () => {
    const alignments: Array<'left' | 'center' | 'right' | 'justify'> = [
      'left',
      'center',
      'right',
      'justify',
    ];

    alignments.forEach((align) => {
      const { getByText } = renderWithTheme(<Text align={align}>{align} aligned</Text>);
      expect(getByText(`${align} aligned`)).toBeTruthy();
    });
  });

  it('applies text decoration', () => {
    const decorations: Array<'none' | 'underline' | 'line-through'> = [
      'none',
      'underline',
      'line-through',
    ];

    decorations.forEach((decoration) => {
      const { getByText } = renderWithTheme(<Text decoration={decoration}>{decoration}</Text>);
      expect(getByText(decoration)).toBeTruthy();
    });
  });

  it('applies text transform', () => {
    const transforms: Array<'none' | 'uppercase' | 'lowercase' | 'capitalize'> = [
      'none',
      'uppercase',
      'lowercase',
      'capitalize',
    ];

    transforms.forEach((transform) => {
      const { getByText } = renderWithTheme(<Text transform={transform}>Test Text</Text>);
      expect(getByText('Test Text')).toBeTruthy();
    });
  });

  it('applies font weight', () => {
    const weights: NonNullable<TextProps['weight']>[] = [
      'thin',
      'light',
      'regular',
      'medium',
      'semibold',
      'bold',
      'extrabold',
      'black',
    ];

    weights.forEach((weight) => {
      const { getByText } = renderWithTheme(<Text weight={weight}>{weight} weight</Text>);
      expect(getByText(`${weight} weight`)).toBeTruthy();
    });
  });

  it('applies italic style', () => {
    const { getByText } = renderWithTheme(<Text italic>Italic Text</Text>);
    const textElement = getByText('Italic Text');
    expect(getFlattenedStyle(textElement)).toMatchObject(
      expect.objectContaining({ fontStyle: 'italic' }),
    );
  });

  it('applies custom size', () => {
    const { getByText } = renderWithTheme(<Text size={24}>Custom Size</Text>);
    const textElement = getByText('Custom Size');
    expect(getFlattenedStyle(textElement)).toMatchObject(expect.objectContaining({ fontSize: 24 }));
  });

  it('applies custom line height', () => {
    const { getByText } = renderWithTheme(<Text lineHeight={30}>Custom Line Height</Text>);
    const textElement = getByText('Custom Line Height');
    expect(getFlattenedStyle(textElement)).toMatchObject(
      expect.objectContaining({ lineHeight: 30 }),
    );
  });

  it('applies custom letter spacing', () => {
    const { getByText } = renderWithTheme(<Text letterSpacing={2}>Custom Spacing</Text>);
    const textElement = getByText('Custom Spacing');
    expect(getFlattenedStyle(textElement)).toMatchObject(
      expect.objectContaining({ letterSpacing: 2 }),
    );
  });

  it('handles numberOfLines prop', () => {
    const { getByText } = renderWithTheme(
      <Text numberOfLines={2}>
        This is a very long text that should be truncated after two lines of content
      </Text>,
    );
    const textElement = getByText(
      'This is a very long text that should be truncated after two lines of content',
    );
    expect(textElement.props['numberOfLines']).toBe(2);
  });

  it('handles ellipsizeMode prop', () => {
    const modes: Array<'head' | 'middle' | 'tail' | 'clip'> = ['head', 'middle', 'tail', 'clip'];

    modes.forEach((mode) => {
      const { getByText } = renderWithTheme(
        <Text ellipsizeMode={mode} numberOfLines={1}>
          Long text
        </Text>,
      );
      const textElement = getByText('Long text');
      expect(textElement.props['ellipsizeMode']).toBe(mode);
    });
  });

  it('handles selectable prop', () => {
    const { getByText } = renderWithTheme(<Text selectable>Selectable Text</Text>);
    const textElement = getByText('Selectable Text');
    expect(textElement.props['selectable']).toBe(true);
  });

  it('applies custom style', () => {
    const customStyle = { backgroundColor: 'yellow' };
    const { getByText } = renderWithTheme(<Text style={customStyle}>Styled Text</Text>);
    expect(getByText('Styled Text')).toBeTruthy();
  });

  it('handles accessibility props', () => {
    const { getByLabelText } = renderWithTheme(
      <Text
        accessibilityLabel="Custom label"
        accessibilityHint="This is a hint"
        accessibilityRole="header"
      >
        Accessible Text
      </Text>,
    );
    expect(getByLabelText('Custom label')).toBeTruthy();
  });

  it('uses text content as accessibility label by default', () => {
    const { getByLabelText } = renderWithTheme(<Text>Default Label</Text>);
    expect(getByLabelText('Default Label')).toBeTruthy();
  });

  it('renders children correctly', () => {
    const { getByText } = renderWithTheme(
      <Text>
        Hello <Text weight="bold">World</Text>
      </Text>,
    );
    expect(getByText(/Hello/)).toBeTruthy();
    expect(getByText('World')).toBeTruthy();
  });
});

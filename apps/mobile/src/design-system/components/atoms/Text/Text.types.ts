/**
 * Text Component - Type Definitions
 */

import type { BaseComponentProps, StyleSystemProps, TypographyVariant } from '../../../types';
import type { StyleProp, TextProps as RNTextProps, TextStyle } from 'react-native';

export interface TextProps
  extends
    Omit<
      RNTextProps,
      | 'style'
      | 'testID'
      | 'accessible'
      | 'accessibilityLabel'
      | 'accessibilityHint'
      | 'accessibilityRole'
      | 'accessibilityState'
      | 'accessibilityValue'
    >,
    BaseComponentProps,
    StyleSystemProps {
  /**
   * Typography variant - determines font size, weight, and spacing
   */
  variant?: TypographyVariant;

  /**
   * Text color from theme or custom color
   */
  color?: string;

  /**
   * Text alignment
   */
  align?: 'left' | 'center' | 'right' | 'justify';

  /**
   * Text decoration
   */
  decoration?: 'none' | 'underline' | 'line-through';

  /**
   * Text transform
   */
  transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';

  /**
   * Font weight override
   */
  weight?: 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

  /**
   * Font size override (use sparingly, prefer variant)
   * Can be a number (e.g., 18) or a fontSize token key (e.g., 'lg', 'md', 'sm')
   */
  size?:
    | number
    | 'xs'
    | 'sm'
    | 'base'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl'
    | '4xl'
    | '5xl'
    | '6xl'
    | '7xl';

  /**
   * Line height override
   */
  lineHeight?: number;

  /**
   * Letter spacing override
   */
  letterSpacing?: number;

  /**
   * Whether text should be italic
   */
  italic?: boolean;

  /**
   * Maximum number of lines before truncation
   */
  numberOfLines?: number;

  /**
   * Text truncation strategy
   */
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';

  /**
   * Whether text is selectable
   */
  selectable?: boolean;

  /**
   * Custom style overrides
   */
  style?: StyleProp<TextStyle>;

  /**
   * Text content
   */
  children?: React.ReactNode;

  // Note: Accessibility props are inherited from BaseComponentProps
  // No need to redefine them here to avoid type conflicts
}

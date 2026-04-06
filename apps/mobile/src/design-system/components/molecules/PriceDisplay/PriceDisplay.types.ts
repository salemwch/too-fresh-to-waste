/**
 * PriceDisplay Molecule - Type Definitions
 * Text + Icon + Semantic Color for price information display
 */

import type { BaseComponentProps, ComponentSize } from '../../../types';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type PriceDisplayVariant = 'default' | 'discounted' | 'original' | 'savings' | 'total';

export interface PriceDisplayProps extends BaseComponentProps {
  /**
   * Current/discounted price (primary price to display)
   */
  price: number;

  /**
   * Original price (before discount)
   */
  originalPrice?: number;

  /**
   * Currency code (e.g., 'USD', 'EUR', 'TND')
   */
  currency?: string;

  /**
   * Currency symbol (e.g., '$', '€', 'د.ت')
   */
  currencySymbol?: string;

  /**
   * Price display variant
   */
  variant?: PriceDisplayVariant;

  /**
   * Size of the price display
   */
  size?: ComponentSize;

  /**
   * Whether to show the savings amount/percentage
   */
  showSavings?: boolean;

  /**
   * How to display savings ('amount' | 'percentage' | 'both')
   */
  savingsDisplay?: 'amount' | 'percentage' | 'both';

  /**
   * Icon to display before price
   */
  icon?: React.ReactNode;

  /**
   * Whether to show currency symbol
   */
  showCurrency?: boolean;

  /**
   * Currency symbol position
   */
  currencyPosition?: 'before' | 'after';

  /**
   * Number of decimal places to show
   */
  decimalPlaces?: number;

  /**
   * Locale for number formatting
   */
  locale?: string;

  /**
   * Whether to use compact notation for large numbers (e.g., 1.2K)
   */
  compactNotation?: boolean;

  /**
   * Custom color override
   */
  color?: string;

  /**
   * Whether to emphasize the price (bold, larger)
   */
  emphasized?: boolean;

  /**
   * Whether to align prices (useful for lists)
   */
  aligned?: boolean;

  /**
   * Custom container style
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Custom price text style
   */
  priceStyle?: StyleProp<TextStyle>;

  /**
   * Custom original price text style
   */
  originalPriceStyle?: StyleProp<TextStyle>;

  /**
   * Custom savings text style
   */
  savingsStyle?: StyleProp<TextStyle>;

  /**
   * Layout direction ('row' | 'column')
   */
  layout?: 'row' | 'column';

  /**
   * Accessibility label override
   */
  accessibilityLabel?: string;
}

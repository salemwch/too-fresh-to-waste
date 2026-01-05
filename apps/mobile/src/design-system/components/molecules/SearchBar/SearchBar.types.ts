/**
 * SearchBar Molecule - Type Definitions
 * Combines Input + Icon + Clear Button for search functionality
 */

import type { BaseComponentProps, ComponentSize } from '../../../types';

export interface SearchBarProps extends BaseComponentProps {
  /**
   * Current search value
   */
  value: string;

  /**
   * Callback when search value changes
   */
  onChangeText: (text: string) => void;

  /**
   * Callback when search is submitted
   */
  onSubmit?: (text: string) => void;

  /**
   * Callback when clear button is pressed
   */
  onClear?: () => void;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Search bar size
   */
  size?: ComponentSize;

  /**
   * Whether the search bar is disabled
   */
  disabled?: boolean;

  /**
   * Whether to show loading state
   */
  loading?: boolean;

  /**
   * Whether to show clear button when text is present
   */
  showClearButton?: boolean;

  /**
   * Custom search icon (defaults to search icon)
   */
  searchIcon?: React.ReactNode;

  /**
   * Custom clear icon (defaults to X icon)
   */
  clearIcon?: React.ReactNode;

  /**
   * Whether to auto-focus on mount
   */
  autoFocus?: boolean;

  /**
   * Search suggestions/autocomplete data
   */
  suggestions?: string[];

  /**
   * Callback when suggestion is selected
   */
  onSuggestionSelect?: (suggestion: string) => void;

  /**
   * Custom container style
   */
  containerStyle?: any;

  /**
   * Custom input style
   */
  inputStyle?: any;

  /**
   * Debounce delay for onChangeText (ms)
   */
  debounceDelay?: number;

  /**
   * Security: Maximum input length
   */
  maxLength?: number;

  /**
   * Validation pattern for input sanitization
   */
  validationPattern?: RegExp;

  /**
   * Accessibility props
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

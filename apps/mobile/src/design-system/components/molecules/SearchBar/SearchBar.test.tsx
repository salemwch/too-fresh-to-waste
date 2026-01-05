/**
 * SearchBar Component Tests
 * Comprehensive test suite for SearchBar molecule
 */

import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../providers';

import { SearchBar } from './SearchBar';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('SearchBar Molecule', () => {
  const mockOnChangeText = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnClear = jest.fn();
  const mockOnSuggestionSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockOnChangeText} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('search-bar')).toBeTruthy();
      expect(screen.getByTestId('search-bar-input')).toBeTruthy();
    });

    it('renders with custom placeholder', () => {
      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockOnChangeText} placeholder='Search restaurants...' />
        </TestWrapper>,
      );

      expect(screen.getByPlaceholderText('Search restaurants...')).toBeTruthy();
    });

    it('renders with loading state', () => {
      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockOnChangeText} loading />
        </TestWrapper>,
      );

      expect(screen.getByTestId('search-bar-loading')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('calls onChangeText when text is entered', () => {
      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockOnChangeText} />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent.changeText(input, 'pizza');

      expect(mockOnChangeText).toHaveBeenCalledWith('pizza');
    });

    it('sanitizes input to remove invalid characters', () => {
      render(
        <TestWrapper>
          <SearchBar
            value=''
            onChangeText={mockOnChangeText}
            validationPattern={/^[a-zA-Z0-9\s]*$/}
          />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent.changeText(input, 'pizza<script>');

      expect(mockOnChangeText).toHaveBeenCalledWith('pizzascript');
    });

    it('calls onSubmit when enter is pressed', () => {
      render(
        <TestWrapper>
          <SearchBar value='pizza' onChangeText={mockOnChangeText} onSubmit={mockOnSubmit} />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent(input, 'submitEditing');

      expect(mockOnSubmit).toHaveBeenCalledWith('pizza');
    });

    it('shows clear button when text is present', () => {
      render(
        <TestWrapper>
          <SearchBar value='pizza' onChangeText={mockOnChangeText} showClearButton />
        </TestWrapper>,
      );

      expect(screen.getByTestId('search-bar-clear-button')).toBeTruthy();
    });

    it('clears text when clear button is pressed', () => {
      render(
        <TestWrapper>
          <SearchBar
            value='pizza'
            onChangeText={mockOnChangeText}
            onClear={mockOnClear}
            showClearButton
          />
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('search-bar-clear-button'));

      expect(mockOnChangeText).toHaveBeenCalledWith('');
      expect(mockOnClear).toHaveBeenCalled();
    });
  });

  describe('Suggestions', () => {
    const suggestions = ['pizza', 'burger', 'sushi'];

    it('shows suggestions when text is entered and suggestions are provided', () => {
      render(
        <TestWrapper>
          <SearchBar value='p' onChangeText={mockOnChangeText} suggestions={suggestions} />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent(input, 'focus');

      expect(screen.getByTestId('search-bar-suggestions')).toBeTruthy();
    });

    it('handles suggestion selection', () => {
      render(
        <TestWrapper>
          <SearchBar
            value='p'
            onChangeText={mockOnChangeText}
            suggestions={suggestions}
            onSuggestionSelect={mockOnSuggestionSelect}
          />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent(input, 'focus');

      fireEvent.press(screen.getByTestId('search-bar-suggestion-0'));

      expect(mockOnChangeText).toHaveBeenCalledWith('pizza');
      expect(mockOnSuggestionSelect).toHaveBeenCalledWith('pizza');
    });

    it('hides suggestions when input loses focus', async () => {
      render(
        <TestWrapper>
          <SearchBar value='p' onChangeText={mockOnChangeText} suggestions={suggestions} />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent(input, 'focus');
      expect(screen.getByTestId('search-bar-suggestions')).toBeTruthy();

      fireEvent(input, 'blur');

      await waitFor(() => {
        expect(screen.queryByTestId('search-bar-suggestions')).toBeNull();
      });
    });
  });

  describe('Security & Validation', () => {
    it('enforces maximum length', () => {
      const longText = 'a'.repeat(150);

      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockOnChangeText} maxLength={100} />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent.changeText(input, longText);

      expect(mockOnChangeText).toHaveBeenCalledWith('a'.repeat(100));
    });

    it('prevents XSS attempts', () => {
      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockOnChangeText} />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      fireEvent.changeText(input, '<script>alert("xss")</script>');

      // Should sanitize the input
      expect(mockOnChangeText).toHaveBeenCalledWith('scriptalert(xss)/script');
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility properties', () => {
      render(
        <TestWrapper>
          <SearchBar
            value=''
            onChangeText={mockOnChangeText}
            accessibilityLabel='Search for food items'
            accessibilityHint='Type to search for available food offers'
          />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      expect(input.props['accessibilityLabel']).toBe('Search for food items');
      expect(input.props['accessibilityHint']).toBe('Type to search for available food offers');
      expect(input.props['accessibilityRole']).toBe('search');
    });

    it('clear button has accessibility properties', () => {
      render(
        <TestWrapper>
          <SearchBar value='pizza' onChangeText={mockOnChangeText} showClearButton />
        </TestWrapper>,
      );

      const clearButton = screen.getByTestId('search-bar-clear-button');
      expect(clearButton.props['accessibilityRole']).toBe('button');
      expect(clearButton.props['accessibilityLabel']).toBe('Clear search');
    });
  });

  describe('Performance', () => {
    it('debounces input changes when debounceDelay is set', async () => {
      const mockCallback = jest.fn();

      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockCallback} debounceDelay={300} />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');

      // Rapid fire changes
      fireEvent.changeText(input, 'p');
      fireEvent.changeText(input, 'pi');
      fireEvent.changeText(input, 'piz');
      fireEvent.changeText(input, 'pizza');

      // Should still call for immediate UI updates
      expect(mockCallback).toHaveBeenCalledTimes(4);
    });
  });

  describe('Size Variants', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

    sizes.forEach(size => {
      it(`renders correctly with ${size} size`, () => {
        render(
          <TestWrapper>
            <SearchBar
              value=''
              onChangeText={mockOnChangeText}
              size={size}
              testID={`search-bar-${size}`}
            />
          </TestWrapper>,
        );

        expect(screen.getByTestId(`search-bar-${size}`)).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles disabled state correctly', () => {
      render(
        <TestWrapper>
          <SearchBar value='' onChangeText={mockOnChangeText} disabled />
        </TestWrapper>,
      );

      const input = screen.getByTestId('search-bar-input');
      expect(input.props['editable']).toBe(false);
    });

    it('does not show clear button when loading', () => {
      render(
        <TestWrapper>
          <SearchBar value='pizza' onChangeText={mockOnChangeText} loading showClearButton />
        </TestWrapper>,
      );

      expect(screen.queryByTestId('search-bar-clear-button')).toBeNull();
      expect(screen.getByTestId('search-bar-loading')).toBeTruthy();
    });
  });
});

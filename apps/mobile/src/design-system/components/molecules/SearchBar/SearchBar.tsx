/**
 * SearchBar Molecule
 * Production-ready search component with input sanitization and accessibility
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Pressable, ActivityIndicator, FlatList } from 'react-native';

import { useTheme } from '../../../providers';
import { Input } from '../../atoms/Input';
import { Text } from '../../atoms/Text';

import type { SearchBarProps } from './SearchBar.types';

// Default icons (would typically import from icon library)
const SearchIcon = () => (
  <View style={{ width: 20, height: 20, backgroundColor: '#666', borderRadius: 10 }} />
);

const ClearIcon = () => (
  <View style={{ width: 16, height: 16, backgroundColor: '#999', borderRadius: 8 }} />
);

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'Search food items...',
  size = 'md',
  disabled = false,
  loading = false,
  showClearButton = true,
  searchIcon = <SearchIcon />,
  clearIcon = <ClearIcon />,
  autoFocus = false,
  suggestions = [],
  onSuggestionSelect,
  containerStyle,
  inputStyle,
  debounceDelay = 300,
  maxLength = 100,
  validationPattern = /^[a-zA-Z0-9\s\-_.,!?]*$/, // Allow alphanumeric, spaces, and basic punctuation
  testID = 'search-bar',
  accessibilityLabel = 'Search for food items',
  accessibilityHint = 'Type to search for available food offers',
  ...rest
}) => {
  const theme = useTheme();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = useRef<any>(null);

  // Input sanitization
  const sanitizeInput = useCallback(
    (text: string): string => {
      // Remove any characters that don't match the validation pattern
      const sanitized = text.replace(/[^\w\s\-_.,!?]/g, '');

      // Limit length
      return sanitized.slice(0, maxLength);
    },
    [maxLength, validationPattern],
  );

  // Debounced change handler
  const handleChangeText = useCallback(
    (text: string) => {
      const sanitizedText = sanitizeInput(text);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Immediate update for UI responsiveness
      onChangeText(sanitizedText);

      // Show suggestions if we have them and text length > 0
      setShowSuggestions(sanitizedText.length > 0 && suggestions.length > 0);

      // Debounced callback for search
      if (debounceDelay > 0) {
        debounceRef.current = setTimeout(() => {
          // Additional processing could go here
        }, debounceDelay);
      }
    },
    [sanitizeInput, onChangeText, suggestions.length, debounceDelay],
  );

  // Clear handler
  const handleClear = useCallback(() => {
    onChangeText('');
    onClear?.();
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChangeText, onClear]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    if (value.trim() && onSubmit) {
      onSubmit(value.trim());
      setShowSuggestions(false);
    }
  }, [value, onSubmit]);

  // Suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      const sanitizedSuggestion = sanitizeInput(suggestion);
      onChangeText(sanitizedSuggestion);
      onSuggestionSelect?.(sanitizedSuggestion);
      setShowSuggestions(false);
    },
    [sanitizeInput, onChangeText, onSuggestionSelect],
  );

  // Focus handlers
  const handleFocus = useCallback(() => {
    if (value.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [value.length, suggestions.length]);

  const handleBlur = useCallback(() => {
    // Delay hiding suggestions to allow suggestion selection
    setTimeout(() => setShowSuggestions(false), 150);
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  // Render clear button
  const renderClearButton = () => {
    if (!showClearButton || !value || loading) return null;

    return (
      <Pressable
        onPress={handleClear}
        style={{
          padding: theme.spacing.base.xs,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        testID={`${testID}-clear-button`}
        accessibilityRole='button'
        accessibilityLabel='Clear search'
        accessibilityHint='Clears the current search text'
      >
        {clearIcon}
      </Pressable>
    );
  };

  // Render loading indicator
  const renderLoadingIndicator = () => {
    if (!loading) return null;

    return (
      <View style={{ padding: theme.spacing.base.xs }}>
        <ActivityIndicator size='small' color={theme.colors.primary} testID={`${testID}-loading`} />
      </View>
    );
  };

  // Memoized renderItem for suggestion FlatList
  const renderSuggestionItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <Pressable
        onPress={() => handleSuggestionSelect(item)}
        style={{
          padding: theme.spacing.base.md,
          borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
          borderBottomColor: theme.colors.outlineVariant,
        }}
        testID={`${testID}-suggestion-${index}`}
        accessibilityRole='button'
        accessibilityLabel={`Select suggestion: ${item}`}
      >
        <Text variant='body.medium' numberOfLines={1}>
          {item}
        </Text>
      </Pressable>
    ),
    [handleSuggestionSelect, theme.spacing.base.md, theme.colors.outlineVariant, suggestions.length, testID],
  );

  // Render suggestions list
  const renderSuggestions = () => {
    if (!showSuggestions || suggestions.length === 0) return null;

    return (
      <View
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.spacing.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.outline,
          maxHeight: 200,
          zIndex: 1000,
          ...theme.shadows.component.modal.sheet,
        }}
        testID={`${testID}-suggestions`}
      >
        <FlatList
          data={suggestions}
          keyExtractor={(_item, index) => `suggestion-${index}`}
          renderItem={renderSuggestionItem}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  return (
    <View style={[containerStyle]} testID={testID}>
      <Input
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        size={size}
        disabled={disabled}
        autoFocus={autoFocus}
        leftIcon={searchIcon}
        rightIcon={renderLoadingIndicator() || renderClearButton()}
        style={inputStyle}
        maxLength={maxLength}
        returnKeyType='search'
        enablesReturnKeyAutomatically
        testID={`${testID}-input`}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole='search'
        {...rest}
      />
      {renderSuggestions()}
    </View>
  );
};

export default SearchBar;

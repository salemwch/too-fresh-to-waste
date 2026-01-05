# Food Waste App Design System

A comprehensive, enterprise-grade design system for the Food Waste Mobile
Application built with React Native and TypeScript.

## 🎨 Overview

This design system follows atomic design principles and provides a consistent
visual language across the entire application. It includes design tokens,
reusable components, utilities, and comprehensive documentation.

## 📁 Structure

```
design-system/
├── tokens/           # Design tokens (colors, typography, spacing, etc.)
├── components/       # Reusable components
│   ├── atoms/        # Basic building blocks
│   ├── molecules/    # Simple component groups
│   └── organisms/    # Complex components
├── providers/        # Theme and context providers
├── utils/           # Utility functions and helpers
├── types/           # TypeScript type definitions
└── __tests__/       # Test files
```

## 🚀 Quick Start

### Installation

The design system is already included in the mobile app. Import components and
utilities as needed:

```tsx
import { Button, Text, Card, useTheme } from '../design-system';
```

### Basic Usage

```tsx
import React from 'react';
import { View } from 'react-native';
import { ThemeProvider, Button, Text, Card } from '../design-system';

const App = () => {
  return (
    <ThemeProvider>
      <View>
        <Card>
          <Text variant='headline.medium'>Welcome to Food Waste App</Text>
          <Text variant='body.medium'>Reduce food waste, save money!</Text>
          <Button variant='primary' onPress={() => console.log('Pressed!')}>
            Get Started
          </Button>
        </Card>
      </View>
    </ThemeProvider>
  );
};
```

## 🎯 Design Tokens

### Colors

The color system includes brand colors, semantic colors, and food-specific
colors:

```tsx
import { colorTokens } from '../design-system';

// Brand colors
colorTokens.base.primary[500]; // #4CAF50
colorTokens.base.secondary[500]; // #FFC107

// Food-specific colors
colorTokens.food.freshness.fresh; // Fresh food indicator
colorTokens.food.categories.bakery; // Bakery category color

// Status colors
colorTokens.status.confirmed; // Order confirmed state
```

### Typography

Type scale with semantic variants:

```tsx
// Usage in components
<Text variant="display.large">Hero Title</Text>
<Text variant="headline.medium">Section Title</Text>
<Text variant="body.medium">Regular content</Text>
<Text variant="label.small">Form labels</Text>
```

### Spacing

8pt grid system for consistent spacing:

```tsx
import { spacingTokens } from '../design-system';

// Base spacing
spacingTokens.base.sm; // 8px
spacingTokens.base.md; // 16px
spacingTokens.base.lg; // 24px

// Semantic spacing
spacingTokens.semantic.card.padding;
spacingTokens.semantic.form.fieldGap;
```

## 🧩 Components

### Atomic Components

#### Button

```tsx
<Button
  variant='primary'
  size='md'
  onPress={handlePress}
  loading={isLoading}
  leftIcon={<Icon name='star' />}
>
  Save to Favorites
</Button>
```

**Props:**

- `variant`: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'outline' |
  'danger' | 'success'
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `loading`: boolean
- `disabled`: boolean
- `fullWidth`: boolean
- `leftIcon` / `rightIcon`: React.ReactNode

#### Text

```tsx
<Text variant='body.medium' color='primary' align='center' numberOfLines={2}>
  Text content
</Text>
```

**Props:**

- `variant`: Typography variants (display, headline, title, body, label)
- `color`: Theme color or custom color
- `align`: 'left' | 'center' | 'right' | 'justify'
- `weight`: Font weight override
- `numberOfLines`: Line clamping

#### Input

```tsx
<Input
  label='Email Address'
  placeholder='Enter your email'
  variant='outlined'
  size='md'
  leftIcon={<EmailIcon />}
  errorText={errors.email}
  required
/>
```

**Props:**

- `variant`: 'default' | 'filled' | 'outlined'
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `label`: String label
- `helperText` / `errorText`: Helper text
- `leftIcon` / `rightIcon`: React.ReactNode
- `required`: Shows asterisk

#### Card

```tsx
<Card variant='elevated' size='md' pressable onPress={handleCardPress}>
  <Text>Card content</Text>
</Card>
```

**Props:**

- `variant`: 'default' | 'elevated' | 'outlined' | 'filled'
- `size`: 'sm' | 'md' | 'lg'
- `pressable`: Makes card touchable
- `loading`: Shows loading overlay

## 🎨 Theming

### Theme Provider

Wrap your app with the ThemeProvider to enable theming:

```tsx
import { ThemeProvider } from '../design-system';

const App = () => (
  <ThemeProvider defaultTheme='auto'>{/* Your app content */}</ThemeProvider>
);
```

### Using Theme

```tsx
import { useTheme } from '../design-system';

const MyComponent = () => {
  const theme = useTheme();

  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      <Text style={{ color: theme.colors.onSurface }}>Themed content</Text>
    </View>
  );
};
```

### Dark Mode

```tsx
const { toggleTheme, colorScheme } = useTheme();

// Toggle between light and dark
<Button onPress={toggleTheme}>
  Switch to {colorScheme === 'light' ? 'Dark' : 'Light'} Mode
</Button>;
```

## 📱 Platform Support

### iOS/Android Variants

Components automatically adapt to platform conventions:

```tsx
// Automatic platform detection
<Button platform="auto" />

// Force specific platform style
<Button platform="ios" />
<Button platform="android" />
```

### Responsive Design

```tsx
import { responsive, isTablet } from '../design-system/utils';

// Responsive values
const spacing = responsive({
  mobile: 16,
  tablet: 24,
  desktop: 32,
});

// Conditional rendering
{
  isTablet && <AdditionalContent />;
}
```

## 🧪 Testing

### Component Testing

```tsx
import { renderWithTheme } from '../design-system/setupTests';
import { Button } from '../design-system';

test('renders button correctly', () => {
  const { getByText } = renderWithTheme(<Button>Test Button</Button>);

  expect(getByText('Test Button')).toBeTruthy();
});
```

### Accessibility Testing

```tsx
import { testAccessibility } from '../design-system/setupTests';

test('button has correct accessibility', () => {
  const { getByRole } = renderWithTheme(<Button>Accessible Button</Button>);

  const button = getByRole('button');
  testAccessibility.expectRole(button, 'button');
});
```

## 🎯 Food-Specific Features

### Food Categories

```tsx
import { colorTokens } from '../design-system';

// Category-specific colors
const categoryColor = colorTokens.food.categories.bakery;
const freshnessColor = colorTokens.food.freshness.urgent;
```

### Order Status Colors

```tsx
import { statusColors } from '../design-system';

// Order lifecycle colors
const statusColor = statusColors.confirmed; // Blue
const readyColor = statusColors.ready; // Green
```

## 🔧 Customization

### Extending Components

```tsx
import { Button, ButtonProps } from '../design-system';

interface FoodButtonProps extends ButtonProps {
  foodCategory?: 'bakery' | 'produce' | 'dairy';
}

const FoodButton: React.FC<FoodButtonProps> = ({ foodCategory, ...props }) => {
  const categoryColor = getCategoryColor(foodCategory);

  return (
    <Button {...props} style={[{ borderColor: categoryColor }, props.style]} />
  );
};
```

### Custom Themes

```tsx
import { createCustomTheme } from '../design-system';

const customTheme = createCustomTheme({
  colors: {
    primary: '#FF6B35', // Custom brand color
    secondary: '#F7931E',
  },
});
```

## 📝 Contributing

### Adding New Components

1. Create component directory in appropriate level (atoms/molecules/organisms)
2. Include: Component.tsx, Component.types.ts, Component.styles.ts, index.ts
3. Add comprehensive tests
4. Update documentation
5. Export from main index

### Design Token Updates

1. Update tokens in `tokens/` directory
2. Update TypeScript types
3. Test all components with new tokens
4. Update documentation

## 🎨 Storybook Integration

Components are documented in Storybook for visual testing and documentation:

```bash
# Run Storybook (when implemented)
npm run storybook
```

## 📱 Best Practices

### Component Usage

- Always use design system components instead of creating custom ones
- Use semantic variants instead of custom styling
- Follow accessibility guidelines
- Test on both iOS and Android
- Support dark mode

### Performance

- Use lazy loading for complex components
- Implement proper memoization
- Optimize images and assets
- Test on lower-end devices

### Accessibility

- Always provide accessibility labels
- Test with screen readers
- Ensure proper color contrast
- Support reduced motion preferences
- Use semantic HTML/RN components

## 📚 Resources

- [Material Design 3](https://m3.material.io/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [Atomic Design](https://atomicdesign.bradfrost.com/)

## 🔄 Migration Guide

When updating design system versions:

1. Check breaking changes in CHANGELOG
2. Update component imports
3. Test visual regressions
4. Update custom themes if needed
5. Run full test suite

---

Built with ❤️ for reducing food waste worldwide.

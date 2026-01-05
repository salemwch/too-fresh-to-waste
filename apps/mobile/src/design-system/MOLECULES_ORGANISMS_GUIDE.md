# Molecules & Organisms - Production Guide

## 🧬 **MOLECULES LAYER**

### **Overview**

Molecules are small, reusable components combining 2-3 atoms with specific
functionality. They follow strict composition rules and maintain security,
accessibility, and performance standards.

---

## **SearchBar** 🔍

**Purpose**: Input + Icon + Clear Button for search functionality **Security**:
Input sanitization, XSS prevention, length validation **Accessibility**: WCAG
2.1 AA compliant, screen reader friendly

### **Usage Example**

```tsx
import { SearchBar } from '../design-system';

const [searchQuery, setSearchQuery] = useState('');
const [suggestions, setSuggestions] = useState(['pizza', 'burger', 'sushi']);

<SearchBar
  value={searchQuery}
  onChangeText={setSearchQuery}
  onSubmit={query => performSearch(query)}
  placeholder='Search food offers...'
  suggestions={suggestions}
  onSuggestionSelect={suggestion => {
    setSearchQuery(suggestion);
    performSearch(suggestion);
  }}
  maxLength={100}
  debounceDelay={300}
  showClearButton
  loading={isSearching}
/>;
```

### **Props API**

```tsx
interface SearchBarProps {
  value: string; // Current search value
  onChangeText: (text: string) => void; // Change handler
  onSubmit?: (text: string) => void; // Submit handler
  placeholder?: string; // Placeholder text
  suggestions?: string[]; // Autocomplete suggestions
  maxLength?: number; // Security: max input length
  validationPattern?: RegExp; // Input sanitization pattern
  debounceDelay?: number; // Performance: debounce delay
  loading?: boolean; // Loading state
  showClearButton?: boolean; // Show clear button
}
```

### **Security Features**

- **Input Sanitization**: Removes XSS characters automatically
- **Length Limits**: Prevents buffer overflow attacks
- **Pattern Validation**: Custom regex for allowed characters
- **Debouncing**: Prevents API spam attacks

---

## **FormField** 📝

**Purpose**: Label + Input + ErrorText for form functionality **Security**:
Type-specific validation, injection prevention **Accessibility**: Full screen
reader support, error announcements

### **Usage Example**

```tsx
import { FormField } from '../design-system';

<FormField
  label='Email Address'
  value={formData.email}
  onChangeText={value => setFormData(prev => ({ ...prev, email: value }))}
  type='email'
  placeholder='Enter your email'
  required
  errorText={errors.email}
  leftIcon={<EmailIcon />}
  validateOnChange
  validator={value => {
    if (!value.includes('@')) return 'Invalid email format';
    return null;
  }}
/>;
```

### **Props API**

```tsx
interface FormFieldProps {
  label?: string; // Field label
  value: string; // Field value
  onChangeText: (text: string) => void; // Change handler
  type?: 'text' | 'email' | 'password' | 'phone' | 'number';
  required?: boolean; // Required field indicator
  errorText?: string; // Error message
  validator?: (value: string) => string | null; // Custom validation
  maxLength?: number; // Security: max length
  validateOnChange?: boolean; // Real-time validation
}
```

### **Security Features**

- **Type-specific Validation**: Email, phone, password patterns
- **Input Sanitization**: Removes dangerous characters
- **Length Validation**: Min/max length enforcement
- **XSS Prevention**: Filters script tags and injection attempts

---

## **FoodTag** 🏷️

**Purpose**: Chip/Button + Icon + Color Token for categorization **Semantic
Colors**: Category-specific, dietary, freshness indicators **Accessibility**:
Color-blind friendly, high contrast

### **Usage Example**

```tsx
import { FoodTag } from '../design-system';

// Category tag
<FoodTag variant="category" category="bakery" size="sm">
  Bakery
</FoodTag>

// Dietary tag
<FoodTag variant="dietary" dietaryType="vegan" pressable onPress={handleTagPress}>
  Vegan
</FoodTag>

// Freshness indicator
<FoodTag variant="freshness" freshnessLevel="urgent" size="xs">
  Expires Soon
</FoodTag>

// Custom tag with close button
<FoodTag
  variant="custom"
  backgroundColor={theme.colors.primary}
  closable
  onClose={handleRemoveTag}
>
  Custom Filter
</FoodTag>
```

### **Props API**

```tsx
interface FoodTagProps {
  variant?: 'category' | 'dietary' | 'freshness' | 'status' | 'custom';
  category?: FoodCategory; // Semantic food category
  dietaryType?: DietaryType; // Dietary restriction type
  freshnessLevel?: FreshnessLevel; // Food freshness indicator
  pressable?: boolean; // Interactive tag
  closable?: boolean; // Removable tag
  onPress?: () => void; // Press handler
  onClose?: () => void; // Close handler
}
```

---

## **PriceDisplay** 💰

**Purpose**: Text + Icon + Semantic Color for price information
**Localization**: Multi-currency support, locale formatting **Calculation**:
Automatic savings computation

### **Usage Example**

```tsx
import { PriceDisplay } from '../design-system';

<PriceDisplay
  price={5.99}
  originalPrice={12.99}
  currency='USD'
  currencySymbol='$'
  size='md'
  showSavings
  savingsDisplay='both'
  variant='discounted'
  emphasized
/>;
```

### **Props API**

```tsx
interface PriceDisplayProps {
  price: number; // Current/discounted price
  originalPrice?: number; // Original price
  currency?: string; // Currency code (USD, EUR, etc.)
  showSavings?: boolean; // Show savings calculation
  savingsDisplay?: 'amount' | 'percentage' | 'both';
  variant?: 'default' | 'discounted' | 'savings';
  emphasized?: boolean; // Bold, prominent display
}
```

---

## **UserAvatar** 👤

**Purpose**: Image + StatusDot for user profile display **Fallbacks**: Initials
generation, error handling **Status**: Online indicators, verification badges

### **Usage Example**

```tsx
import { UserAvatar } from '../design-system';

<UserAvatar
  name='John Doe'
  imageUri='https://example.com/avatar.jpg'
  size='lg'
  status='online'
  showStatus
  verified
  isMerchant
  pressable
  onPress={() => viewProfile(user.id)}
/>;
```

### **Props API**

```tsx
interface UserAvatarProps {
  name: string; // User name for initials fallback
  imageUri?: string; // Avatar image URL
  size?: ComponentSize; // Avatar size
  status?: 'online' | 'offline' | 'busy' | 'away';
  showStatus?: boolean; // Show status indicator
  verified?: boolean; // Verification badge
  isMerchant?: boolean; // Merchant indicator
  pressable?: boolean; // Interactive avatar
}
```

---

## 🌱 **ORGANISMS LAYER**

### **Overview**

Organisms are complex UI blocks combining molecules and atoms into functional
units. They remain presentational with props-driven data and actions.

---

## **FoodCard** 🍕

**Purpose**: Card + Image + PriceDisplay + CTA Button for food offers
**Responsive**: Multiple layout options, orientation support **Interactive**:
Favorite, share, reserve actions

### **Usage Example**

```tsx
import { FoodCard } from '../design-system';

const offer: FoodOfferData = {
  id: 'offer-1',
  title: 'Fresh Bakery Items',
  description: 'Assorted pastries from this morning',
  imageUri: 'https://example.com/image.jpg',
  price: 5.99,
  originalPrice: 12.99,
  currency: 'USD',
  establishmentName: 'Corner Bakery',
  establishmentId: 'est-1',
  freshnessLevel: 'fresh',
  dietaryTags: ['vegetarian', 'organic'],
  // ... other properties
};

<FoodCard
  offer={offer}
  layout='standard'
  orientation='vertical'
  onPress={offer => navigateToDetails(offer.id)}
  onReserve={offer => reserveOffer(offer.id)}
  onFavorite={offer => toggleFavorite(offer.id)}
  onShare={offer => shareOffer(offer)}
  showDetails
  showActions
  showFavorite
  showShare
/>;
```

### **Props API**

```tsx
interface FoodCardProps {
  offer: FoodOfferData; // Complete offer data
  layout?: 'compact' | 'standard' | 'detailed';
  orientation?: 'vertical' | 'horizontal';
  onPress?: (offer: FoodOfferData) => void;
  onReserve?: (offer: FoodOfferData) => void;
  onFavorite?: (offer: FoodOfferData) => void;
  onShare?: (offer: FoodOfferData) => void;
  showDetails?: boolean; // Show description, tags, etc.
  showActions?: boolean; // Show reserve button
  loading?: boolean; // Loading state
}

interface FoodOfferData {
  id: string;
  title: string;
  description?: string;
  imageUri?: string;
  price: number;
  originalPrice?: number;
  establishmentName: string;
  freshnessLevel?: 'fresh' | 'moderate' | 'urgent';
  dietaryTags?: string[];
  // ... complete type definition
}
```

---

## **LoginForm** 🔐

**Purpose**: FormField(email) + FormField(password) + SubmitButton **Security**:
Input validation, XSS prevention, password strength **Features**: Social login,
remember me, forgot password

### **Usage Example**

```tsx
import { LoginForm } from '../design-system';

<LoginForm
  onSubmit={async data => {
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }}
  onForgotPassword={() => navigate('/forgot-password')}
  onSignUp={() => navigate('/register')}
  onGoogleLogin={() => signInWithGoogle()}
  errors={formErrors}
  errorMessage={serverError}
  loading={isLoading}
  showSocialLogin
  showRememberMe
  title='Welcome Back'
  subtitle='Sign in to reduce food waste'
/>;
```

### **Props API**

```tsx
interface LoginFormProps {
  onSubmit: (data: LoginFormData) => void | Promise<void>;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  onGoogleLogin?: () => void;
  errors?: Partial<Record<keyof LoginFormData, string>>;
  errorMessage?: string;
  loading?: boolean;
  showSocialLogin?: boolean;
  showRememberMe?: boolean;
  validators?: {
    email?: (value: string) => string | null;
    password?: (value: string) => string | null;
  };
}

interface LoginFormData {
  email: string;
  password: string;
}
```

---

## 🛡️ **SECURITY FEATURES**

### **Input Sanitization**

```tsx
// Automatic XSS prevention in all form components
const sanitizeInput = (text: string): string => {
  return text.replace(/[<>'"]/g, ''); // Remove potential XSS chars
};
```

### **Validation Patterns**

```tsx
// Email validation with security checks
const emailValidator = (value: string): string | null => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(value)) return 'Invalid email';

  // Security: Check for injection patterns
  if (value.includes('<') || value.includes('>')) {
    return 'Invalid characters in email';
  }
  return null;
};
```

### **Length Limits**

```tsx
// Prevent buffer overflow attacks
maxLength={100} // All inputs have maximum length
```

---

## ♿ **ACCESSIBILITY FEATURES**

### **Screen Reader Support**

```tsx
// All components include proper accessibility props
accessibilityLabel = 'Search for food items';
accessibilityHint = 'Type to search for available food offers';
accessibilityRole = 'searchbox';
```

### **Keyboard Navigation**

```tsx
// Proper tab order and focus management
returnKeyType = 'search';
enablesReturnKeyAutomatically;
```

### **Color Contrast**

```tsx
// WCAG 2.1 AA compliant color ratios
contrast: {
  normal: 4.5,  // WCAG AA
  large: 3.0    // WCAG AA Large
}
```

---

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Debouncing**

```tsx
// Prevent excessive API calls
<SearchBar debounceDelay={300} />
```

### **Image Optimization**

```tsx
// Lazy loading and error handling
<Image
  source={{ uri: imageUri }}
  onError={handleImageError}
  onLoad={handleImageLoad}
/>
```

### **Memory Management**

```tsx
// Cleanup on unmount
useEffect(() => {
  return () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  };
}, []);
```

---

## 🧪 **TESTING STRATEGY**

### **Component Testing**

```tsx
import { renderWithTheme } from '../../../setupTests';

test('SearchBar handles user input correctly', () => {
  const mockOnChangeText = jest.fn();

  const { getByTestId } = renderWithTheme(
    <SearchBar value='' onChangeText={mockOnChangeText} />,
  );

  fireEvent.changeText(getByTestId('search-bar-input'), 'pizza');
  expect(mockOnChangeText).toHaveBeenCalledWith('pizza');
});
```

### **Accessibility Testing**

```tsx
test('FoodCard has correct accessibility properties', () => {
  const { getByTestId } = renderWithTheme(
    <FoodCard offer={mockOffer} onPress={mockOnPress} />,
  );

  const card = getByTestId('food-card');
  expect(card.props.accessibilityRole).toBe('button');
  expect(card.props.accessibilityLabel).toContain('Fresh Bakery Items');
});
```

### **Security Testing**

```tsx
test('FormField prevents XSS attacks', () => {
  const mockOnChangeText = jest.fn();

  const { getByTestId } = renderWithTheme(
    <FormField value='' onChangeText={mockOnChangeText} type='email' />,
  );

  fireEvent.changeText(
    getByTestId('form-field-input'),
    '<script>alert("xss")</script>',
  );
  expect(mockOnChangeText).toHaveBeenCalledWith('scriptalert(xss)/script');
});
```

---

## 📱 **PLATFORM CONSIDERATIONS**

### **iOS Specific**

```tsx
// iOS haptic feedback
Platform.OS === 'ios' && HapticFeedback.impactAsync('light');

// iOS shadow system
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.1,
shadowRadius: 4,
```

### **Android Specific**

```tsx
// Android elevation
elevation: 4,

// Android ripple effect
android_ripple: {
  color: theme.colors.primary + '20',
  borderless: false,
}
```

---

## 🎨 **THEMING INTEGRATION**

### **Theme-Aware Components**

```tsx
const { colors, spacing, typography, shadows } = useTheme();

// All components automatically adapt to light/dark mode
backgroundColor: colors.surface,
color: colors.onSurface,
```

### **Responsive Design**

```tsx
// Components adapt to screen size
const styles = responsive({
  mobile: { padding: 8 },
  tablet: { padding: 16 },
  desktop: { padding: 24 },
});
```

---

## 🔄 **INTEGRATION EXAMPLES**

### **Search Implementation**

```tsx
const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodOfferData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const offers = await searchAPI.searchOffers(searchQuery);
      setResults(offers);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onSubmit={handleSearch}
        loading={loading}
        placeholder='Search for food offers...'
      />

      <FlatList
        data={results}
        renderItem={({ item }) => (
          <FoodCard
            offer={item}
            onPress={offer => navigate('OfferDetails', { id: offer.id })}
            onReserve={handleReserveOffer}
          />
        )}
      />
    </View>
  );
};
```

### **Form Integration**

```tsx
const AuthScreen = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  const handleLogin = async (data: LoginFormData) => {
    try {
      await authService.login(data.email, data.password);
      navigate('Dashboard');
    } catch (error) {
      setErrors({ general: error.message });
    }
  };

  return (
    <LoginForm
      onSubmit={handleLogin}
      errors={errors}
      onForgotPassword={() => navigate('ForgotPassword')}
      onSignUp={() => navigate('Register')}
    />
  );
};
```

This molecules and organisms layer provides **production-ready**, **secure**,
and **accessible** components that follow enterprise-grade patterns used by
companies like Uber Eats, DoorDash, and Too Good To Go.

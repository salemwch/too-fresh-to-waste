# Mobile Filter UI Implementation Guide

## Overview

This guide shows how to implement the complete 4-dimensional filter system in your mobile app with a beautiful, modern UI.

## Features Implemented

### ✅ Backend Integration

- All 4 filter dimensions properly sent to backend API
- Correct query parameter mapping
- Type-safe implementation

### ✅ Modern UI Components

- **FilterBottomSheet**: Beautiful animated bottom sheet with all filter options
- **ActiveFilterChips**: Show active filters as removable chips
- Icon chips for establishment types (🍞 🍽️ ☕ 🏨)
- Flag chips for cuisine types (🇮🇹 🇨🇳 🇯🇵 🇫🇷)
- Category pills for food types (🍕 🥐 🍝 🍰)
- Radio buttons for offer types (🎁 📦 🍱)
- Live result count in apply button
- Clear all functionality

---

## Files Created

```
apps/mobile/src/features/
├── offers/
│   ├── types/offer.types.ts              # ✅ Updated with EstablishmentType enum
│   └── services/offersService.ts         # ✅ Updated with new filter params
├── search/
│   ├── components/
│   │   ├── FilterBottomSheet.tsx         # 🆕 Main filter UI
│   │   ├── ActiveFilterChips.tsx         # 🆕 Active filter display
│   │   └── index.ts                      # ✅ Updated exports
│   ├── constants/
│   │   └── filterOptions.ts              # 🆕 Filter options data
│   └── types/
│       └── filter.types.ts               # 🆕 Filter state types
```

---

## Usage Example: Integration in SearchScreen

### Step 1: Import Dependencies

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { FilterBottomSheet, ActiveFilterChips } from '../components';
import type { FilterState } from '../types/filter.types';
import { INITIAL_FILTER_STATE, hasActiveFilters } from '../types/filter.types';
import { offersService } from '@/features/offers/services/offersService';
import type { OfferSearchParams } from '@/features/offers/types/offer.types';
```

### Step 2: Add State Management

```typescript
export const SearchScreen: React.FC = () => {
  // Filter state
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // Search results
  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  // ... other state ...
```

### Step 3: Convert Filters to API Params

```typescript
// Convert filter state to API parameters
const buildSearchParams = useCallback((): OfferSearchParams => {
  const params: OfferSearchParams = {
    page: 1,
    limit: 20,
  };

  // Offer type
  if (filters.offerType) {
    params.type = filters.offerType;
  }

  // Establishment type (single value)
  if (filters.establishmentTypes.length > 0) {
    params.establishmentType = filters.establishmentTypes[0];
  }

  // Cuisine types (array)
  if (filters.cuisineTypes.length > 0) {
    params.cuisineTypes = filters.cuisineTypes;
  }

  // Categories (array)
  if (filters.categories.length > 0) {
    params.categories = filters.categories;
  }

  return params;
}, [filters]);
```

### Step 4: Fetch Offers with Filters

```typescript
// Fetch offers with filters
const fetchOffers = useCallback(async () => {
  try {
    setIsLoading(true);

    const params = buildSearchParams();
    const userLocation = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };

    const response = await offersService.getAllOffers(params, userLocation);

    setOffers(response.data);
    setResultCount(response.meta.total);
  } catch (error) {
    console.error('Failed to fetch offers:', error);
  } finally {
    setIsLoading(false);
  }
}, [buildSearchParams, currentLocation]);

// Fetch when filters change
useEffect(() => {
  fetchOffers();
}, [fetchOffers]);
```

### Step 5: Filter Handlers

```typescript
// Handle filter apply
const handleApplyFilters = useCallback((newFilters: FilterState) => {
  setFilters(newFilters);
  setIsFilterVisible(false);
  // fetchOffers will be called automatically via useEffect
}, []);

// Handle clear all filters
const handleClearAllFilters = useCallback(() => {
  setFilters(INITIAL_FILTER_STATE);
  setIsFilterVisible(false);
}, []);

// Handle remove individual filter
const handleRemoveOfferType = useCallback(() => {
  setFilters((prev) => ({ ...prev, offerType: null }));
}, []);

const handleRemoveEstablishmentType = useCallback((type: EstablishmentType) => {
  setFilters((prev) => ({
    ...prev,
    establishmentTypes: prev.establishmentTypes.filter((t) => t !== type),
  }));
}, []);

const handleRemoveCuisineType = useCallback((cuisine: string) => {
  setFilters((prev) => ({
    ...prev,
    cuisineTypes: prev.cuisineTypes.filter((c) => c !== cuisine),
  }));
}, []);

const handleRemoveCategory = useCallback((category: string) => {
  setFilters((prev) => ({
    ...prev,
    categories: prev.categories.filter((c) => c !== category),
  }));
}, []);
```

### Step 6: UI Integration

```typescript
  return (
    <View style={styles.container}>
      {/* Header with filter button */}
      <View style={styles.header}>
        <Input
          placeholder="Search offers..."
          // ... search props
        />

        {/* Filter Button */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setIsFilterVisible(true)}
        >
          <Icon name="filter" size={24} color={colors.text} />
          {hasActiveFilters(filters) && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {countActiveFilters(filters)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filter Chips */}
      {hasActiveFilters(filters) && (
        <ActiveFilterChips
          filters={filters}
          onRemoveOfferType={handleRemoveOfferType}
          onRemoveEstablishmentType={handleRemoveEstablishmentType}
          onRemoveCuisineType={handleRemoveCuisineType}
          onRemoveCategory={handleRemoveCategory}
          onClearAll={handleClearAllFilters}
        />
      )}

      {/* Results */}
      <FlatList
        data={offers}
        renderItem={({ item }) => <OfferCard offer={item} />}
        // ... other props
      />

      {/* Filter Bottom Sheet */}
      <FilterBottomSheet
        visible={isFilterVisible}
        filters={filters}
        resultCount={resultCount}
        isLoading={isLoading}
        onClose={() => setIsFilterVisible(false)}
        onApply={handleApplyFilters}
        onClear={handleClearAllFilters}
      />
    </View>
  );
};
```

---

## Styling Example

```typescript
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
```

---

## API Request Examples

### No Filters (Default)

```
GET /api/offers?page=1&limit=20&latitude=36.8065&longitude=10.1815
```

### With Establishment Type Filter

```
GET /api/offers?page=1&limit=20&establishmentType=BAKERY&latitude=36.8065&longitude=10.1815
```

### With Multiple Filters

```
GET /api/offers
  ?page=1
  &limit=20
  &type=SURPRISE_BAG
  &establishmentType=RESTAURANT
  &cuisineTypes=italian
  &cuisineTypes=french
  &categories=pizza
  &categories=pasta
  &latitude=36.8065
  &longitude=10.1815
```

---

## Filter State Structure

```typescript
interface FilterState {
  // Offer type (radio selection)
  offerType: OfferType | null; // null | 'surprise_bag' | 'specific_items' | 'meal_deal'

  // Establishment types (multi-select)
  establishmentTypes: EstablishmentType[]; // ['BAKERY', 'RESTAURANT', ...]

  // Cuisine types (multi-select)
  cuisineTypes: string[]; // ['italian', 'asian', 'french', ...]

  // Food categories (multi-select)
  categories: string[]; // ['pizza', 'bakery', 'pasta', ...]

  // Price range (future enhancement)
  priceRange: {
    min: number | null;
    max: number | null;
  };

  // Minimum discount (future enhancement)
  minDiscount: number | null;
}
```

---

## Available Filter Options

### Establishment Types (8 options)

```typescript
const ESTABLISHMENT_TYPE_OPTIONS = [
  { value: 'BAKERY', label: 'Bakery', icon: '🍞' },
  { value: 'RESTAURANT', label: 'Restaurant', icon: '🍽️' },
  { value: 'CAFE', label: 'Cafe', icon: '☕' },
  { value: 'HOTEL', label: 'Hotel', icon: '🏨' },
  { value: 'GROCERY_STORE', label: 'Grocery', icon: '🛒' },
  { value: 'FAST_FOOD', label: 'Fast Food', icon: '🍔' },
  { value: 'SUPERMARKET', label: 'Supermarket', icon: '🏪' },
  { value: 'OTHER', label: 'Other', icon: '📦' },
];
```

### Cuisine Types (10 options)

```typescript
const CUISINE_TYPE_OPTIONS = [
  { value: 'italian', label: 'Italian', flag: '🇮🇹' },
  { value: 'asian', label: 'Asian', flag: '🇨🇳' },
  { value: 'japanese', label: 'Japanese', flag: '🇯🇵' },
  { value: 'french', label: 'French', flag: '🇫🇷' },
  { value: 'mexican', label: 'Mexican', flag: '🇲🇽' },
  { value: 'tunisian', label: 'Tunisian', flag: '🇹🇳' },
  { value: 'mediterranean', label: 'Mediterranean', flag: '🌊' },
  { value: 'american', label: 'American', flag: '🇺🇸' },
  { value: 'indian', label: 'Indian', flag: '🇮🇳' },
  { value: 'lebanese', label: 'Lebanese', flag: '🇱🇧' },
];
```

### Food Categories (12 options)

```typescript
const CATEGORY_OPTIONS = [
  { value: 'pizza', label: 'Pizza', icon: '🍕' },
  { value: 'bakery', label: 'Bakery', icon: '🥐' },
  { value: 'pasta', label: 'Pasta', icon: '🍝' },
  { value: 'dessert', label: 'Dessert', icon: '🍰' },
  { value: 'breakfast', label: 'Breakfast', icon: '🥞' },
  { value: 'lunch', label: 'Lunch', icon: '🍱' },
  { value: 'dinner', label: 'Dinner', icon: '🍛' },
  { value: 'sandwich', label: 'Sandwich', icon: '🥪' },
  { value: 'salad', label: 'Salad', icon: '🥗' },
  { value: 'soup', label: 'Soup', icon: '🍲' },
  { value: 'sushi', label: 'Sushi', icon: '🍣' },
  { value: 'burger', label: 'Burger', icon: '🍔' },
];
```

---

## Testing Checklist

- [ ] Filter button shows badge when filters are active
- [ ] Active filter chips display correctly
- [ ] Clicking chip removes that specific filter
- [ ] "Clear All" removes all filters
- [ ] Filter bottom sheet opens smoothly
- [ ] Selecting/deselecting filters works
- [ ] Apply button shows correct result count
- [ ] API receives correct query parameters
- [ ] Results update after applying filters
- [ ] Closing sheet without applying keeps old filters
- [ ] Multiple filters combine correctly (AND logic)

---

## Performance Considerations

1. **Debounced API Calls**: Consider debouncing filter changes if users can change filters rapidly
2. **Result Caching**: Cache filter results to avoid redundant API calls
3. **Optimistic Updates**: Update UI before API call for better perceived performance
4. **Lazy Loading**: Load categories/cuisines from backend if list grows large

---

## Future Enhancements

1. **Price Range Slider**: Add dual-thumb slider for price filtering
2. **Minimum Discount**: Add slider for discount percentage
3. **Sort Options**: Add sorting (distance, price, rating, expiry)
4. **Save Filter Presets**: Allow users to save favorite filter combinations
5. **Location-based Filters**: Filter by specific neighborhoods/districts
6. **Time-based Filters**: "Pickup Today", "Pickup Tomorrow"
7. **Dietary Filters**: Vegan, vegetarian, gluten-free, etc.

---

## Troubleshooting

### Filters not sent to backend

- Check `offersService.getAllOffers()` query param construction
- Verify backend receives params in network inspector
- Ensure filter state is properly updated

### UI not updating after filter change

- Verify `useEffect` dependency array includes `fetchOffers`
- Check that `setFilters()` is called correctly
- Ensure `buildSearchParams()` has correct dependencies

### Bottom sheet not closing

- Verify `onClose` prop is passed and calls `setIsFilterVisible(false)`
- Check for any React errors in console

---

**Implementation Status**: ✅ Complete & Ready for Integration

**Last Updated**: 2026-01-24

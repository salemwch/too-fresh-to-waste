/**
 * FoodCard Component Tests
 * Comprehensive test suite for FoodCard organism
 */

import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '../../../providers';

import { FoodCard } from './FoodCard';

import type { FoodOfferData } from './FoodCard.types';

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

// Mock offer data
const mockOffer: FoodOfferData = {
  id: 'offer-1',
  title: 'Fresh Bakery Items',
  description: 'Assorted pastries and bread from this morning',
  imageUri: 'https://example.com/image.jpg',
  price: 5.99,
  originalPrice: 12.99,
  currency: 'USD',
  quantity: 2,
  availableQuantity: 2,
  establishmentName: 'Corner Bakery',
  establishmentId: 'est-1',
  category: 'bakery',
  dietaryTags: ['vegetarian', 'organic'],
  freshnessLevel: 'fresh',
  pickupTimeStart: '2024-01-15T14:00:00Z',
  pickupTimeEnd: '2024-01-15T16:00:00Z',
  distance: 0.5,
  rating: 4.5,
  reviewCount: 128,
  isFavorite: false,
  isReserved: false,
  estimatedWeight: '500g',
};

describe('FoodCard Organism', () => {
  const mockOnPress = jest.fn();
  const mockOnReserve = jest.fn();
  const mockOnFavorite = jest.fn();
  const mockOnShare = jest.fn();
  const mockOnViewEstablishment = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly with default props', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('food-card')).toBeTruthy();
      expect(screen.getByTestId('food-card-title')).toBeTruthy();
      expect(screen.getByTestId('food-card-price')).toBeTruthy();
    });

    it('displays offer information correctly', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} />
        </TestWrapper>,
      );

      expect(screen.getByText('Fresh Bakery Items')).toBeTruthy();
      expect(screen.getByText('Corner Bakery')).toBeTruthy();
      expect(screen.getByText('Assorted pastries and bread from this morning')).toBeTruthy();
    });

    it('renders with compact layout', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} layout='compact' testID='compact-card' />
        </TestWrapper>,
      );

      expect(screen.getByTestId('compact-card')).toBeTruthy();
    });

    it('renders with horizontal orientation', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} orientation='horizontal' testID='horizontal-card' />
        </TestWrapper>,
      );

      expect(screen.getByTestId('horizontal-card')).toBeTruthy();
    });
  });

  describe('User Interactions', () => {
    it('calls onPress when card is pressed', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} onPress={mockOnPress} />
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('food-card'));
      expect(mockOnPress).toHaveBeenCalledWith(mockOffer);
    });

    it('calls onReserve when reserve button is pressed', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} onReserve={mockOnReserve} />
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('food-card-reserve'));
      expect(mockOnReserve).toHaveBeenCalledWith(mockOffer);
    });

    it('calls onFavorite when favorite button is pressed', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} onFavorite={mockOnFavorite} showFavorite />
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('food-card-favorite'));
      expect(mockOnFavorite).toHaveBeenCalledWith(mockOffer);
    });

    it('calls onShare when share button is pressed', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} onShare={mockOnShare} showShare />
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('food-card-share'));
      expect(mockOnShare).toHaveBeenCalledWith(mockOffer);
    });

    it('calls onViewEstablishment when establishment name is pressed', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} onViewEstablishment={mockOnViewEstablishment} />
        </TestWrapper>,
      );

      fireEvent.press(screen.getByTestId('food-card-establishment'));
      expect(mockOnViewEstablishment).toHaveBeenCalledWith(mockOffer.establishmentId);
    });
  });

  describe('Visual States', () => {
    it('displays loading state', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} loading />
        </TestWrapper>,
      );

      // Card should be in loading state
      expect(screen.getByTestId('food-card')).toBeTruthy();
    });

    it('displays disabled state', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} disabled />
        </TestWrapper>,
      );

      // Interactions should not work when disabled
      fireEvent.press(screen.getByTestId('food-card-reserve'));
      expect(mockOnReserve).not.toHaveBeenCalled();
    });

    it('shows reserved state correctly', () => {
      const reservedOffer = { ...mockOffer, isReserved: true };

      render(
        <TestWrapper>
          <FoodCard offer={reservedOffer} />
        </TestWrapper>,
      );

      expect(screen.getByText('Reserved')).toBeTruthy();
    });

    it('shows sold out state when quantity is 0', () => {
      const soldOutOffer = { ...mockOffer, availableQuantity: 0 };

      render(
        <TestWrapper>
          <FoodCard offer={soldOutOffer} />
        </TestWrapper>,
      );

      expect(screen.getByText('Sold Out')).toBeTruthy();
    });

    it('shows favorite state correctly', () => {
      const favoriteOffer = { ...mockOffer, isFavorite: true };

      render(
        <TestWrapper>
          <FoodCard offer={favoriteOffer} showFavorite />
        </TestWrapper>,
      );

      // Favorite button should be visible and in filled state
      expect(screen.getByTestId('food-card-favorite')).toBeTruthy();
    });
  });

  describe('Content Display Options', () => {
    it('hides details when showDetails is false', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showDetails={false} />
        </TestWrapper>,
      );

      expect(screen.queryByTestId('food-card-description')).toBeNull();
    });

    it('hides actions when showActions is false', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showActions={false} />
        </TestWrapper>,
      );

      expect(screen.queryByTestId('food-card-reserve')).toBeNull();
    });

    it('hides establishment when showEstablishment is false', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showEstablishment={false} />
        </TestWrapper>,
      );

      expect(screen.queryByTestId('food-card-establishment')).toBeNull();
    });

    it('shows pickup time when available', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showPickupTime />
        </TestWrapper>,
      );

      // Should display pickup time in some format
      expect(screen.getByText(/14:00/)).toBeTruthy();
    });

    it('shows distance when available', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showDistance />
        </TestWrapper>,
      );

      expect(screen.getByText('0.5km')).toBeTruthy();
    });

    it('shows rating when available', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showRating />
        </TestWrapper>,
      );

      expect(screen.getByText('4.5 (128)')).toBeTruthy();
    });
  });

  describe('Image Handling', () => {
    it('renders image when imageUri is provided', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('food-card-image')).toBeTruthy();
    });

    it('shows fallback when no imageUri is provided', () => {
      const { imageUri, ...offerWithoutImage } = mockOffer;

      render(
        <TestWrapper>
          <FoodCard offer={offerWithoutImage} />
        </TestWrapper>,
      );

      expect(screen.getByText('No Image')).toBeTruthy();
    });
  });

  describe('Price Display', () => {
    it('displays price correctly', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('food-card-price')).toBeTruthy();
    });

    it('shows savings when original price is higher', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} />
        </TestWrapper>,
      );

      // Should show savings calculation
      expect(screen.getByTestId('food-card-price')).toBeTruthy();
    });
  });

  describe('Tags and Categories', () => {
    it('displays dietary tags when available', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showDetails />
        </TestWrapper>,
      );

      expect(screen.getByText('vegetarian')).toBeTruthy();
      expect(screen.getByText('organic')).toBeTruthy();
    });

    it('displays freshness level tag', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} />
        </TestWrapper>,
      );

      expect(screen.getByText('fresh')).toBeTruthy();
    });

    it('limits the number of dietary tags displayed', () => {
      const offerWithManyTags = {
        ...mockOffer,
        dietaryTags: ['vegetarian', 'organic', 'gluten-free', 'vegan', 'kosher'],
      };

      render(
        <TestWrapper>
          <FoodCard offer={offerWithManyTags} showDetails />
        </TestWrapper>,
      );

      // Should only show first 3 tags
      expect(screen.getByText('vegetarian')).toBeTruthy();
      expect(screen.getByText('organic')).toBeTruthy();
      expect(screen.getByText('gluten-free')).toBeTruthy();
      expect(screen.queryByText('vegan')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility properties', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} onPress={mockOnPress} />
        </TestWrapper>,
      );

      const card = screen.getByTestId('food-card');
      expect(card.props['accessibilityRole']).toBe('button');
      expect(card.props['accessibilityLabel']).toContain('Fresh Bakery Items');
      expect(card.props['accessibilityLabel']).toContain('Corner Bakery');
    });

    it('buttons have proper accessibility labels', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} showFavorite showShare />
        </TestWrapper>,
      );

      const favoriteButton = screen.getByTestId('food-card-favorite');
      expect(favoriteButton.props['accessibilityLabel']).toBe('Add to favorites');

      const shareButton = screen.getByTestId('food-card-share');
      expect(shareButton.props['accessibilityLabel']).toBe('Share offer');
    });

    it('handles custom accessibility label', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} accessibilityLabel='Custom accessibility label' />
        </TestWrapper>,
      );

      const card = screen.getByTestId('food-card');
      expect(card.props['accessibilityLabel']).toBe('Custom accessibility label');
    });
  });

  describe('Performance', () => {
    it('truncates title and description to specified lines', () => {
      render(
        <TestWrapper>
          <FoodCard offer={mockOffer} titleLines={1} descriptionLines={1} />
        </TestWrapper>,
      );

      const title = screen.getByTestId('food-card-title');
      const description = screen.getByTestId('food-card-description');

      expect(title.props['numberOfLines']).toBe(1);
      expect(description.props['numberOfLines']).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('handles missing offer data gracefully', () => {
      const incompleteOffer = {
        id: 'incomplete',
        title: 'Test',
        price: 5,
        quantity: 1,
        availableQuantity: 1,
        establishmentName: 'Test',
        establishmentId: 'test',
      } as FoodOfferData;

      render(
        <TestWrapper>
          <FoodCard offer={incompleteOffer} />
        </TestWrapper>,
      );

      expect(screen.getByTestId('food-card')).toBeTruthy();
      expect(screen.getByText('Test')).toBeTruthy();
    });
  });
});

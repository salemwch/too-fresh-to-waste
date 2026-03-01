/**
 * RestaurantHero Component
 * Hero section for offer details with image, navigation, and establishment info
 */

import React from 'react';
import { View, Image, StyleSheet, Pressable, Dimensions } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { Badge } from '@/design-system/components/atoms/Badge';
import { useTheme } from '@/design-system/providers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RestaurantHeroProps {
  /** Offer hero image URL */
  heroImage: string;
  /** Items left count */
  itemsLeft: number;
  /** Establishment name */
  name: string;
  /** Establishment location (city) */
  location: string;
  /** Establishment logo URL */
  logoImage?: string;
  /** Back button callback */
  onBack: () => void;
  /** Share button callback */
  onShare?: () => void;
  /** Favorite button callback */
  onFavorite?: () => void;
  /** Is favorited flag */
  isFavorite?: boolean;
  /** Test ID */
  testID?: string;
}

export const RestaurantHero: React.FC<RestaurantHeroProps> = ({
  heroImage,
  itemsLeft,
  name,
  location,
  logoImage,
  onBack,
  onShare,
  onFavorite,
  isFavorite = false,
  testID = 'restaurant-hero',
}) => {
  const theme = useTheme();

  return (
    <View style={styles.container} testID={testID}>
      {/* Hero Image with Gradient */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: heroImage }}
          style={styles.heroImage}
          resizeMode='cover'
          testID={`${testID}-image`}
        />

        {/* Gradient Overlay - darker at bottom for text readability */}
        <View style={styles.gradientTop} />
        <View style={styles.gradientBottom} />

        {/* Navigation Buttons */}
        <View style={styles.navButtons}>
          <Pressable
            style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.9)' }]}
            onPress={onBack}
            accessibilityLabel='Go back'
            testID={`${testID}-back-button`}
          >
            <Icon name='chevron-left' size={20} color={theme.colors.onSurface} />
          </Pressable>

          <View style={styles.rightButtons}>
            {onShare && (
              <Pressable
                style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.9)' }]}
                onPress={onShare}
                accessibilityLabel='Share'
                testID={`${testID}-share-button`}
              >
                <Icon name='share-2' size={20} color={theme.colors.onSurface} />
              </Pressable>
            )}
            {onFavorite && (
              <Pressable
                style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.9)' }]}
                onPress={onFavorite}
                accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                testID={`${testID}-favorite-button`}
              >
                <Icon
                  name='heart'
                  size={20}
                  color={isFavorite ? '#005250' : theme.colors.onSurface}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* Items Left Badge */}
        <View style={styles.badgeContainer}>
          <Badge
            variant='warning'
            size='md'
            testID={`${testID}-items-badge`}
            style={{ backgroundColor: '#fbf9be' }}
          >
            <Text variant='label' size='sm' weight='bold' style={{ color: '#005250' }}>
              {itemsLeft} left
            </Text>
          </Badge>
        </View>

        {/* Restaurant Info with Logo - Positioned ON the image */}
        <View style={styles.infoContainerOnImage}>
          {logoImage && (
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: logoImage }}
                style={styles.logo}
                resizeMode='contain'
                testID={`${testID}-logo`}
              />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text
              variant='headline'
              size='lg'
              weight='bold'
              numberOfLines={1}
              style={styles.nameText}
            >
              {name}
            </Text>
            <Text variant='body' size='sm' numberOfLines={1} style={styles.locationText}>
              {location}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: 260,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  navButtons: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 64,
    left: 16,
  },
  infoContainerOnImage: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    padding: 4,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  locationText: {
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

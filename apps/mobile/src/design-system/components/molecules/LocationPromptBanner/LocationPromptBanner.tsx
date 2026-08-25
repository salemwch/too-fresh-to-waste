/**
 * LocationPromptBanner Component
 *
 * Dismissable banner prompting user to enable location for nearby offers.
 * Shown on HomeScreen when location hasn't been requested yet.
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { useTheme } from '../../../providers';
import { Text, Button, Card, Icon } from '../../atoms';

import type { LocationPromptBannerProps } from './LocationPromptBanner.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

export const LocationPromptBanner = memo<LocationPromptBannerProps>(
  ({ onEnable, onDismiss, variant = 'expanded', isLoading = false, style, testID }) => {
    const { t } = useTranslation();
    const theme = useTheme();

    if (variant === 'compact') {
      return (
        <View
          style={[
            styles.compactContainer,
            { backgroundColor: theme.colors.primaryContainer },
            style,
          ]}
          testID={testID}
          accessibilityRole='alert'
          accessibilityLabel={t('location.a11yEnableNearby')}
          accessibilityHint={t('location.a11yBannerHint')}
        >
          <Icon
            name='location-sharp'
            family='Ionicons'
            size={18}
            color={theme.colors.primary}
            style={styles.compactIcon}
          />
          <Text
            variant='body'
            size='sm'
            weight='medium'
            style={styles.compactText}
            numberOfLines={1}
          >
            Enable location for nearby offers
          </Text>
          <Button
            variant='ghost'
            size='sm'
            onPress={onEnable}
            disabled={isLoading}
            accessibilityLabel={t('location.a11yEnableLocation')}
            accessibilityHint={t('location.a11yRequestPermissionHint')}
          >
            {isLoading ? <ActivityIndicator size='small' color={theme.colors.primary} /> : 'Enable'}
          </Button>
          <Pressable
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t('location.a11yDismissBanner')}
            accessibilityHint={t('location.a11yDismissBannerHint')}
            accessibilityRole='button'
          >
            <Icon name='close' family='Ionicons' size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>
      );
    }

    // Expanded variant
    return (
      <Card style={[styles.expandedContainer, style]} testID={testID}>
        <Pressable
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t('location.a11yDismissBanner')}
          accessibilityHint={t('location.a11yDismissBannerHint')}
          accessibilityRole='button'
        >
          <Icon name='close' family='Ionicons' size={20} color={theme.colors.onSurfaceVariant} />
        </Pressable>

        <View style={styles.expandedContent}>
          <View
            style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}
            accessibilityElementsHidden
          >
            <Icon name='location-sharp' family='Ionicons' size={28} color={theme.colors.primary} />
          </View>

          <View style={styles.textContainer}>
            <Text variant='title' size='md' weight='semibold' style={styles.title}>
              See offers near you
            </Text>
            <Text variant='body' size='sm' color='secondary' style={styles.description}>
              Enable location to discover surplus food from nearby restaurants and save money while
              reducing waste.
            </Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Button
            variant='ghost'
            size='md'
            onPress={onDismiss}
            style={styles.dismissTextButton}
            accessibilityLabel={t('location.notNow')}
            accessibilityHint={t('location.a11yNotNowHint')}
          >
            {t('location.notNow')}
          </Button>
          <Button
            variant='primary'
            size='md'
            onPress={onEnable}
            disabled={isLoading}
            style={styles.enableButton}
            accessibilityLabel={t('location.a11yEnableLocation')}
            accessibilityHint={t('location.a11yEnableLocationHint')}
          >
            {isLoading ? (
              <ActivityIndicator size='small' color={theme.colors.onPrimary} />
            ) : (
              'Enable Location'
            )}
          </Button>
        </View>
      </Card>
    );
  },
);

const styles = StyleSheet.create({
  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp[3],
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  compactIcon: {
    marginEnd: 8,
  },
  compactText: {
    flex: 1,
  },

  // Expanded variant
  expandedContainer: {
    padding: 16,
    marginBottom: 16,
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    insetInlineEnd: 12,
    zIndex: 1,
    padding: 4,
  },
  expandedContent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: sp[3],
  },
  textContainer: {
    flex: 1,
    paddingEnd: 24, // Space for dismiss button
  },
  title: {
    marginBottom: 4,
  },
  description: {
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  dismissTextButton: {
    marginEnd: 8,
  },
  enableButton: {
    minWidth: 140,
  },
});

LocationPromptBanner.displayName = 'LocationPromptBanner';

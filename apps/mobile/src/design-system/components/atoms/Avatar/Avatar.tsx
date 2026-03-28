/**
 * Avatar Component
 * User avatar with support for images, initials, icons, and status indicators
 */

import React, { forwardRef, useState } from 'react';
import { View, Image, Pressable, ActivityIndicator } from 'react-native';
import FastImage from 'react-native-fast-image';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';
import { Text } from '../Text';

import { createAvatarStyles, getAvatarSize } from './Avatar.styles';

import type { AvatarProps } from './Avatar.types';

export const Avatar = forwardRef<
  React.ElementRef<typeof View> | React.ElementRef<typeof Pressable>,
  AvatarProps
>(
  function Avatar(
    {
      size = 'md',
      variant = 'circular',
      source,
      uri,
      initials,
      iconName = 'person',
      backgroundColor,
      color,
      borderColor,
      borderWidth,
      showStatus = false,
      status = 'offline',
      pressable = false,
      onPress,
      loading = false,
      style,
      imageStyle,
      testID,
      accessibilityLabel,
      accessibilityHint,
      accessibilityRole,
      onBlur: _onBlur,
      onFocus: _onFocus,
      ...rest
    },
    ref,
  ) {
    const theme = useTheme();
    const { colors } = theme;
    const [imageError, setImageError] = useState(false);

    // Calculate avatar size
    const avatarSize = getAvatarSize(size, theme);

    // Create styles
    const styles = createAvatarStyles(
      theme,
      avatarSize,
      variant,
      backgroundColor,
      borderColor,
      borderWidth,
    );

    // Determine what to render inside avatar
    const renderAvatarContent = () => {
      // 1. Try to render image
      if ((source || uri) && !imageError) {
        // Use FastImage for network URIs (disk + memory caching)
        const resolvedUri = uri ?? (source && typeof source === 'object' && 'uri' in source ? (source as { uri?: string }).uri : undefined);
        if (resolvedUri) {
          return (
            <FastImage
              source={{ uri: resolvedUri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
              style={[styles.image, imageStyle]}
              onError={() => setImageError(true)}
              resizeMode={FastImage.resizeMode.cover}
            />
          );
        }
        // Fallback to RN Image for local/static sources (require())
        return (
          <Image
            source={source || { uri }}
            style={[styles.image, imageStyle]}
            onError={() => setImageError(true)}
            resizeMode='cover'
          />
        );
      }

      // 2. Render initials if provided
      if (initials) {
        // Get first 2 characters of initials
        const displayInitials = initials.substring(0, 2).toUpperCase();

        return (
          <View style={styles.initialsContainer}>
            <Text style={[styles.initialsText, color && { color }]}>{displayInitials}</Text>
          </View>
        );
      }

      // 3. Fallback to icon
      return (
        <View style={styles.iconContainer}>
          <Icon name={iconName} size={avatarSize * 0.6} color={color || colors.onPrimary} />
        </View>
      );
    };

    // Render status indicator
    const renderStatusIndicator = () => {
      if (!showStatus) return null;

      const statusStyleMap = {
        online: styles.statusOnline,
        offline: styles.statusOffline,
        away: styles.statusAway,
        busy: styles.statusBusy,
      };

      return <View style={[styles.statusIndicator, statusStyleMap[status]]} />;
    };

    // Render loading overlay
    const renderLoadingOverlay = () => {
      if (!loading) return null;

      return (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size='small' color={colors.onPrimary} />
        </View>
      );
    };

    // Render avatar content
    const avatarContent = (
      <>
        {renderAvatarContent()}
        {renderStatusIndicator()}
        {renderLoadingOverlay()}
      </>
    );

    // If pressable, wrap in Pressable
    if (pressable && onPress) {
      return (
        <Pressable
          ref={ref as React.RefObject<React.ElementRef<typeof Pressable>>}
          style={[styles.container, style]}
          onPress={onPress}
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityRole={accessibilityRole || 'button'}
          {...rest}
        >
          {avatarContent}
        </Pressable>
      );
    }

    // Regular non-pressable avatar
    return (
      <View
        ref={ref as React.RefObject<React.ElementRef<typeof View>>}
        style={[styles.container, style]}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole={accessibilityRole || 'image'}
        {...rest}
      >
        {avatarContent}
      </View>
    );
  },
);


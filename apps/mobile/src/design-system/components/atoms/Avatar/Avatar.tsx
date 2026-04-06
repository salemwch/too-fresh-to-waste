/**
 * Avatar Component
 * User avatar with support for images, initials, icons, and status indicators
 */

import React, { forwardRef, useState } from 'react';
import { View, Image, Pressable, ActivityIndicator } from 'react-native';
import FastImage, { type FastImageProps } from 'react-native-fast-image';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';
import { Text } from '../Text';

import { createAvatarStyles, getAvatarSize } from './Avatar.styles';

import type { AvatarProps } from './Avatar.types';

const hasNonEmptyString = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

const getUriFromImageSource = (source: AvatarProps['source']): string | undefined => {
  if (source === undefined || typeof source === 'number' || Array.isArray(source)) {
    return undefined;
  }

  return hasNonEmptyString(source.uri) ? source.uri : undefined;
};

export const Avatar = forwardRef<
  React.ElementRef<typeof View> | React.ElementRef<typeof Pressable>,
  AvatarProps
>(
  (
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
  ) => {
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
      const hasImageSource = source !== undefined;
      const hasUri = hasNonEmptyString(uri);

      if ((hasImageSource || hasUri) && !imageError) {
        // Use FastImage for network URIs (disk + memory caching)
        const resolvedUri = hasUri ? uri : getUriFromImageSource(source);
        if (resolvedUri !== undefined) {
          return (
            <FastImage
              source={{
                uri: resolvedUri,
                priority: FastImage.priority.normal,
                cache: FastImage.cacheControl.immutable,
              }}
              style={[styles.image, imageStyle] as FastImageProps['style']}
              onError={() => setImageError(true)}
              resizeMode={FastImage.resizeMode.cover}
            />
          );
        }
        // Fallback to RN Image for local/static sources (require())
        const fallbackSource = source ?? (hasUri ? { uri } : undefined);
        if (fallbackSource === undefined) {
          return null;
        }

        return (
          <Image
            source={fallbackSource}
            style={[styles.image, imageStyle]}
            onError={() => setImageError(true)}
            resizeMode='cover'
          />
        );
      }

      // 2. Render initials if provided
      if (hasNonEmptyString(initials)) {
        // Get first 2 characters of initials
        const displayInitials = initials.substring(0, 2).toUpperCase();

        return (
          <View style={styles.initialsContainer}>
            <Text style={[styles.initialsText, color !== undefined ? { color } : undefined]}>
              {displayInitials}
            </Text>
          </View>
        );
      }

      // 3. Fallback to icon
      return (
        <View style={styles.iconContainer}>
          <Icon name={iconName} size={avatarSize * 0.6} color={color ?? colors.onPrimary} />
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
    if (pressable && onPress !== undefined) {
      return (
        <Pressable
          ref={ref as React.RefObject<React.ElementRef<typeof Pressable>>}
          style={[styles.container, style]}
          onPress={onPress}
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityRole={accessibilityRole ?? 'button'}
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
        accessibilityRole={accessibilityRole ?? 'image'}
        {...rest}
      >
        {avatarContent}
      </View>
    );
  },
);

Avatar.displayName = 'Avatar';

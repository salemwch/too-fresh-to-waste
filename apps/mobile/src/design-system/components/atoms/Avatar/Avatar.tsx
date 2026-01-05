/**
 * Avatar Component
 * User avatar with support for images, initials, icons, and status indicators
 */

import React, { forwardRef, useState } from 'react';
import { View, Image, TouchableOpacity, ActivityIndicator } from 'react-native';

import { useTheme } from '../../../providers';
import { Icon } from '../Icon';
import { Text } from '../Text';

import { createAvatarStyles, getAvatarSize } from './Avatar.styles';

import type { AvatarProps } from './Avatar.types';

export const Avatar = forwardRef<
  React.ElementRef<typeof View> | React.ElementRef<typeof TouchableOpacity>,
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
      if ((source || uri) && !imageError) {
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

    // If pressable, wrap in TouchableOpacity
    if (pressable && onPress) {
      return (
        <TouchableOpacity
          ref={ref as React.RefObject<React.ElementRef<typeof TouchableOpacity>>}
          style={[styles.container, style]}
          onPress={onPress}
          activeOpacity={0.7}
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityRole={accessibilityRole || 'button'}
          {...rest}
        >
          {avatarContent}
        </TouchableOpacity>
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

Avatar.displayName = 'Avatar';

export default Avatar;

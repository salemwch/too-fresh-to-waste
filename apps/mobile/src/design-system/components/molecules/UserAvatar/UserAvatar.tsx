/**
 * UserAvatar Molecule
 * Production-ready avatar component with status indicators and fallbacks
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Pressable,
  Image,
  ActivityIndicator,
  type AccessibilityRole,
} from 'react-native';

import { useTheme } from '../../../providers';
import { Text } from '../../atoms/Text';

import type { UserAvatarProps } from './UserAvatar.types';

// Verification badge placeholder (uses primary color from theme context)
const VerifiedBadge: React.FC<{ color: string }> = ({ color }) => (
  <View
    style={{
      width: 16,
      height: 16,
      backgroundColor: color,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>✓</Text>
  </View>
);

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  imageUri,
  size = 'md',
  variant = 'circular',
  status = 'offline',
  showStatus = false,
  pressable = false,
  onPress,
  backgroundColor,
  textColor,
  borderColor,
  borderWidth = 0,
  loading = false,
  loadingComponent,
  onImageError,
  onImageLoad,
  isMerchant = false,
  verified = false,
  badge,
  badgePosition = 'bottom-right',
  style,
  imageStyle,
  textStyle,
  resizeMode = 'cover',
  testID = 'user-avatar',
  accessibilityLabel,
  ...rest
}) => {
  const theme = useTheme();
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!imageUri);

  // Generate initials from name
  const getInitials = useMemo(
    () =>
      name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase(),
    [name],
  );

  // Generate consistent background color from name if not provided
  const getBackgroundColor = useMemo(() => {
    if (backgroundColor) return backgroundColor;

    // Generate color from name hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
      theme.colors.primary,
      theme.colors.secondary,
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
      '#98D8C8',
      '#F7DC6F',
    ];

    return colors[Math.abs(hash) % colors.length];
  }, [name, backgroundColor, theme.colors]);

  // Get size dimensions
  const getSizeDimensions = useMemo(() => {
    const { sizing } = theme.spacing;

    switch (size) {
      case 'xs':
        return { size: sizing.avatar.xs, fontSize: 10, statusSize: 8 };
      case 'sm':
        return { size: sizing.avatar.sm, fontSize: 12, statusSize: 10 };
      case 'md':
        return { size: sizing.avatar.md, fontSize: 14, statusSize: 12 };
      case 'lg':
        return { size: sizing.avatar.lg, fontSize: 18, statusSize: 14 };
      case 'xl':
        return { size: sizing.avatar.xl, fontSize: 24, statusSize: 16 };
      default:
        return { size: sizing.avatar.md, fontSize: 14, statusSize: 12 };
    }
  }, [theme.spacing.sizing, size]);

  // Get border radius based on variant
  const getBorderRadius = useMemo(() => {
    switch (variant) {
      case 'circular':
        return getSizeDimensions.size / 2;
      case 'rounded':
        return theme.spacing.radius.md;
      case 'square':
        return 0;
      default:
        return getSizeDimensions.size / 2;
    }
  }, [variant, getSizeDimensions.size, theme.spacing.radius.md]);

  // Get status color using theme tokens for consistency
  const getStatusColor = useMemo(() => {
    switch (status) {
      case 'online':
        return theme.colors.primary; // Primary brand color for online status
      case 'busy':
        return theme.colors.error; // Error color for busy status
      case 'away':
        return theme.colors.warning; // Warning color for away status
      case 'offline':
      case 'invisible':
      default:
        return theme.colors.neutral[500]; // Neutral gray for offline
    }
  }, [status, theme.colors]);

  // Handle image load error
  const handleImageError = useCallback(() => {
    setImageLoadError(true);
    setImageLoading(false);
    onImageError?.();
  }, [onImageError]);

  // Handle image load success
  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageLoadError(false);
    onImageLoad?.();
  }, [onImageLoad]);

  // Handle press
  const handlePress = useCallback(() => {
    if (!loading && onPress) {
      onPress();
    }
  }, [loading, onPress]);

  // Container styles
  const containerStyles = useMemo(
    () => ({
      width: getSizeDimensions.size,
      height: getSizeDimensions.size,
      borderRadius: getBorderRadius,
      backgroundColor: getBackgroundColor,
      borderWidth,
      borderColor: borderColor || theme.colors.outline,
      overflow: 'hidden' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      position: 'relative' as const,
    }),
    [
      getSizeDimensions.size,
      getBorderRadius,
      getBackgroundColor,
      borderWidth,
      borderColor,
      theme.colors.outline,
    ],
  );

  // Text styles for initials
  const initialsTextStyles = useMemo(
    () => ({
      fontSize: getSizeDimensions.fontSize,
      fontWeight: theme.typography.fontWeight?.semibold ?? '600',
      color: textColor || theme.colors.onPrimary,
    }),
    [
      getSizeDimensions.fontSize,
      theme.typography.fontWeight?.semibold ?? '600',
      textColor,
      theme.colors.onPrimary,
    ],
  );

  // Render loading state
  const renderLoading = () => {
    if (!loading && !imageLoading) return null;

    return (
      <View
        style={{
          ...containerStyles,
          backgroundColor: theme.colors.surfaceVariant,
        }}
      >
        {loadingComponent || (
          <ActivityIndicator
            size='small'
            color={theme.colors.primary}
            testID={`${testID}-loading`}
          />
        )}
      </View>
    );
  };

  // Render avatar content
  const renderAvatarContent = () => {
    // Show loading state
    if (loading || imageLoading) {
      return renderLoading();
    }

    // Show image if available and no error
    if (imageUri && !imageLoadError) {
      return (
        <View style={containerStyles}>
          <Image
            source={{ uri: imageUri }}
            style={[
              {
                width: getSizeDimensions.size,
                height: getSizeDimensions.size,
                borderRadius: getBorderRadius,
              },
              imageStyle,
            ]}
            resizeMode={resizeMode}
            onError={handleImageError}
            onLoad={handleImageLoad}
            testID={`${testID}-image`}
          />
        </View>
      );
    }

    // Show initials fallback
    return (
      <View style={containerStyles}>
        <Text style={[initialsTextStyles, textStyle]} testID={`${testID}-initials`}>
          {getInitials}
        </Text>
      </View>
    );
  };

  // Render status indicator
  const renderStatusIndicator = () => {
    if (!showStatus) return null;

    return (
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: getSizeDimensions.statusSize,
          height: getSizeDimensions.statusSize,
          borderRadius: getSizeDimensions.statusSize / 2,
          backgroundColor: getStatusColor,
          borderWidth: 2,
          borderColor: theme.colors.background,
        }}
        testID={`${testID}-status`}
      />
    );
  };

  // Render badge (verification, etc.)
  const renderBadge = () => {
    if (!badge && !verified) return null;

    const badgeComponent = badge || (verified && <VerifiedBadge color={theme.colors.primary} />);

    const getBadgePosition = () => {
      const offset = 2;
      switch (badgePosition) {
        case 'top-left':
          return { top: offset, left: offset };
        case 'top-right':
          return { top: offset, right: offset };
        case 'bottom-left':
          return { bottom: offset, left: offset };
        case 'bottom-right':
        default:
          return { bottom: offset, right: offset };
      }
    };

    return (
      <View
        style={{
          position: 'absolute',
          ...getBadgePosition(),
        }}
        testID={`${testID}-badge`}
      >
        {badgeComponent}
      </View>
    );
  };

  // Accessibility props with proper TypeScript types
  const accessibilityRole: AccessibilityRole = pressable ? 'button' : 'image';
  const accessibilityProps = {
    accessibilityLabel:
      accessibilityLabel ||
      `${name}'s avatar${isMerchant ? ', merchant' : ''}${verified ? ', verified' : ''}`,
    accessibilityRole,
    ...(pressable && { accessibilityHint: 'Double tap to view profile' }),
    accessibilityState: {
      disabled: loading,
    },
  };

  // Wrapper component
  const AvatarWrapper = pressable ? Pressable : View;
  const wrapperProps = pressable
    ? {
        onPress: handlePress,
        disabled: loading,
      }
    : {};

  return (
    <AvatarWrapper
      style={[{ position: 'relative' }, style]}
      testID={testID}
      {...accessibilityProps}
      {...wrapperProps}
      {...rest}
    >
      {renderAvatarContent()}
      {renderStatusIndicator()}
      {renderBadge()}
    </AvatarWrapper>
  );
};

export default UserAvatar;

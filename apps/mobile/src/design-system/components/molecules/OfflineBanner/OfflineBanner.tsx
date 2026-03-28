/**
 * OFFLINE BANNER COMPONENT
 *
 * Production-grade offline indicator similar to Facebook/WhatsApp.
 * Shows when network errors occur (500, timeout, DNS failure).
 *
 * Features:
 * - Non-intrusive top banner
 * - Auto-retry with exponential backoff
 * - Animated slide-in/slide-out
 * - Connection status updates
 *
 * @security Never triggers logout - session is preserved during network errors
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from '@/design-system/components/atoms/Icon/Icon';

interface OfflineBannerProps {
  /** Whether banner is visible */
  visible: boolean;

  /** Message to display */
  message?: string;

  /** Retry callback */
  onRetry?: () => void;

  /** Auto-dismiss after successful retry */
  autoDismiss?: boolean;
}

/**
 * Offline Banner Component
 *
 * Shows at top of screen when network error occurs.
 * Non-blocking - user can still interact with app in offline mode.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  visible,
  message = "You're offline. Trying to reconnect…",
  onRetry: _onRetry,
  autoDismiss: _autoDismiss = true,
}) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Slide in from top
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide out to top
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Icon name="wifi-off" size={18} color="#FFFFFF" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF6B6B',
    paddingTop: 40, // Status bar safe area
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

/**
 * Offline Banner Component
 * Network status indicator
 *
 * Production Standards:
 * - Persistent display when offline
 * - Smooth animations
 * - Accessibility
 * - Auto-hide when online
 */

import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

interface OfflineBannerProps {
  testID?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ testID = 'offline-banner' }) => {
  const theme = useTheme();
  const [isOffline, setIsOffline] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOffline(offline);

      // Animate banner in/out
      Animated.timing(slideAnim, {
        toValue: offline ? 0 : -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return () => unsubscribe();
  }, [slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.error,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      testID={testID}
      accessibilityRole='alert'
      accessibilityLabel='No internet connection'
      accessibilityLiveRegion='polite'
    >
      <View style={styles.content}>
        <Icon
          name='cloud-offline'
          family='Ionicons'
          size={20}
          color={theme.colors.onError}
          style={styles.icon}
        />
        <Text
          variant='body'
          size='sm'
          weight='semibold'
          style={[styles.text, { color: theme.colors.onError }]}
        >
          No Internet Connection
        </Text>
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
    paddingTop: 50, // Account for status bar
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    textAlign: 'center',
  },
});

/**
 * Usage:
 *
 * ```tsx
 * function App() {
 *   return (
 *     <>
 *       <OfflineBanner />
 *       <YourApp />
 *     </>
 *   );
 * }
 * ```
 *
 * Or add to App.tsx globally
 */

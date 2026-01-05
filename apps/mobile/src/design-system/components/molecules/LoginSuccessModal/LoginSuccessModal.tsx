/**
 * Login Success Modal
 * Brief celebration modal shown after successful login
 * Auto-dismisses after 3 seconds
 */

import LottieView from 'lottie-react-native';
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Dimensions } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

const { width, height } = Dimensions.get('window');

interface LoginSuccessModalProps {
  visible: boolean;
  userName: string;
  onDismiss: () => void;
}

export const LoginSuccessModal: React.FC<LoginSuccessModalProps> = ({
  visible,
  userName,
  onDismiss,
}) => {
  const theme = useTheme();
  const lottieRef = useRef<LottieView>(null);

  // Animated values for celebration effects
  const confettiScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Play Lottie animation
      lottieRef.current?.play();

      // Confetti scale animation
      confettiScale.value = withSpring(1, {
        damping: 10,
        stiffness: 100,
      });

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 3000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, confettiScale, onDismiss]);

  const confettiAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: confettiScale.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        {/* Lottie Success Animation */}
        <Animated.View style={[styles.lottieContainer, confettiAnimatedStyle]}>
          <LottieView
            ref={lottieRef}
            // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
            source={require('./success-celebration.json')}
            autoPlay
            loop={false}
            style={styles.lottie}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Content Container */}
        <Animated.View
          entering={ZoomIn.duration(400)}
          style={[styles.contentContainer, { backgroundColor: theme.colors.surface }]}
        >
          {/* Success Badge */}
          <Animated.View entering={ZoomIn.delay(200).duration(300)} style={styles.badgeContainer}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.successContainer,
                  borderColor: theme.colors.success,
                },
              ]}
            >
              <Text style={styles.badgeEmoji}>🎉</Text>
            </View>
          </Animated.View>

          {/* Welcome Text */}
          <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.textContainer}>
            <Text variant="headline.large" align="center" style={styles.title}>
              Welcome Back!
            </Text>
            <Text
              variant="headline.medium"
              align="center"
              style={[styles.subtitle, { color: theme.colors.primary }]}
            >
              {userName} 🌟
            </Text>
            <Text
              variant="body.medium"
              align="center"
              style={[styles.message, { color: theme.colors.onSurfaceVariant }]}
            >
              Great to see you again!
            </Text>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

/* eslint-disable react-native/no-color-literals */
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  lottieContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width,
    height,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    shadowColor: 'rgba(0, 0, 0, 1)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: -60,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  badgeEmoji: {
    fontSize: 40,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    fontSize: 28,
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
  },
});

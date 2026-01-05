/**
 * ImpactMoment Component
 * Beautiful post-purchase animation showing user's donation impact
 * Enterprise-grade with smooth animations and error handling
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

interface ImpactMomentProps {
  visible: boolean;
  donationAmount: number;
  totalDonations: number;
  mealCount: number;
  onDismiss: () => void;
  currency?: string;
}

const { width } = Dimensions.get('window');

export const ImpactMoment: React.FC<ImpactMomentProps> = ({
  visible,
  donationAmount,
  totalDonations,
  mealCount,
  onDismiss,
  currency = 'TND',
}) => {
  const heartScale = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      heartScale.setValue(0);
      fadeAnim.setValue(0);
      sparkleAnim.setValue(0);

      // Start animations sequence
      Animated.parallel([
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Heart pulse
        Animated.sequence([
          Animated.timing(heartScale, {
            toValue: 1.2,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(heartScale, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
          }),
        ]),
        // Sparkle animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(sparkleAnim, {
              toValue: 1,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(sparkleAnim, {
              toValue: 0,
              duration: 1000,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 3000);

      return () => clearTimeout(timer);
    }

    // Return undefined when not visible (satisfies TypeScript)
    return undefined;
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.content}>
          {/* Sparkles */}
          <Animated.Text style={[styles.sparkle, styles.sparkleLeft, { opacity: sparkleOpacity }]}>
            ✨
          </Animated.Text>
          <Animated.Text style={[styles.sparkle, styles.sparkleRight, { opacity: sparkleOpacity }]}>
            ✨
          </Animated.Text>

          {/* Heart Icon */}
          <Animated.Text
            style={[
              styles.heartIcon,
              {
                transform: [{ scale: heartScale }],
              },
            ]}
          >
            💚
          </Animated.Text>

          {/* Title */}
          <Text style={styles.title}>Thank You!</Text>

          {/* Donation Amount */}
          <View style={styles.donationBox}>
            <Text style={styles.label}>You contributed</Text>
            <Text style={styles.amount}>
              {donationAmount.toFixed(2)} {currency}
            </Text>
            <Text style={styles.sublabel}>to feeding someone in need</Text>
          </View>

          {/* Community Stats */}
          <View style={styles.statsBox}>
            <Text style={styles.statsLabel}>Together we've donated:</Text>
            <Text style={styles.statsValue}>
              {totalDonations.toFixed(2)} {currency}
            </Text>
            <Text style={styles.mealsText}>
              🍽️ That's {mealCount} meals! 🍽️
            </Text>
          </View>

          {/* Auto-dismiss indicator */}
          <Text style={styles.dismissText}>Auto-closing in 3s...</Text>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sparkle: {
    fontSize: 40,
    position: 'absolute',
    top: 20,
  },
  sparkleLeft: {
    left: 30,
  },
  sparkleRight: {
    right: 30,
  },
  heartIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 24,
  },
  donationBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  statsBox: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  mealsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  dismissText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

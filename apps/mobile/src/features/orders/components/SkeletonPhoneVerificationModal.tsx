/**
 * SkeletonPhoneVerificationModal
 * Shimmer skeleton shown while the order-creation API call is in flight
 * for UNVERIFIED users. Layout mirrors PhoneVerificationModal exactly
 * so the skeleton -> real-modal transition feels seamless.
 *
 * Uses native driver animations for 60fps performance.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
  Easing,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SkeletonPhoneVerificationModalProps {
  visible: boolean;
}

export const SkeletonPhoneVerificationModal: React.FC<SkeletonPhoneVerificationModalProps> = React.memo(({
  visible,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Entry / exit animation — mirrors PhoneVerificationModal bezier curves
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim, slideAnim]);

  // Shimmer loop — same cadence as SkeletonOrderSuccessModal
  useEffect(() => {
    if (!visible) return;

    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [visible, shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBox = ({
    width,
    height,
    borderRadius = 8,
    style,
  }: {
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E2E8F0',
          borderRadius,
          opacity: shimmerOpacity,
        },
        style,
      ]}
    />
  );

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Animated backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />

        {/* Animated bottom sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Title skeleton */}
          <SkeletonBox
            width={220}
            height={26}
            borderRadius={13}
            style={styles.titleSkeleton}
          />

          {/* Subtitle skeleton — two lines */}
          <SkeletonBox
            width="90%"
            height={14}
            borderRadius={7}
            style={styles.subtitleLine1}
          />
          <SkeletonBox
            width="70%"
            height={14}
            borderRadius={7}
            style={styles.subtitleLine2}
          />

          {/* Label skeleton */}
          <SkeletonBox
            width={110}
            height={14}
            borderRadius={7}
            style={styles.labelSkeleton}
          />

          {/* Phone input row skeleton (prefix + input) */}
          <View style={styles.phoneRow}>
            <SkeletonBox width={60} height={52} borderRadius={12} />
            <SkeletonBox
              width="100%"
              height={52}
              borderRadius={12}
              style={styles.phoneInput}
            />
          </View>

          {/* CTA button skeleton */}
          <SkeletonBox
            width="100%"
            height={52}
            borderRadius={12}
            style={styles.buttonSkeleton}
          />

          {/* Cancel link skeleton */}
          <SkeletonBox
            width={60}
            height={14}
            borderRadius={7}
            style={styles.cancelSkeleton}
          />
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: 400,
    alignItems: 'center',
  },
  titleSkeleton: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  subtitleLine1: {
    alignSelf: 'center',
    marginBottom: 4,
  },
  subtitleLine2: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  labelSkeleton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 16,
    gap: 0,
  },
  phoneInput: {
    flex: 1,
    marginLeft: -1, // overlap like the real prefix/input join
  },
  buttonSkeleton: {
    marginTop: 8,
  },
  cancelSkeleton: {
    alignSelf: 'center',
    marginTop: 16,
  },
});

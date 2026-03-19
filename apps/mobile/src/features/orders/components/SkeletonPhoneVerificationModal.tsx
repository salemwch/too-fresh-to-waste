/**
 * SkeletonPhoneVerificationModal
 * Shimmer skeleton shown while the order-creation API call is in flight
 * for UNVERIFIED users. Layout mirrors PhoneVerificationModal exactly.
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

import { SkeletonBox, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SkeletonPhoneVerificationModalProps {
  visible: boolean;
}

export const SkeletonPhoneVerificationModal: React.FC<SkeletonPhoneVerificationModalProps> = React.memo(({
  visible,
}) => {
  const anim = useShimmerAnimation('pulse', visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <SkeletonBox animValue={anim} width={220} height={26} borderRadius={13} style={styles.titleSkeleton} />
          <SkeletonBox animValue={anim} width="90%" height={14} borderRadius={7} style={styles.subtitleLine1} />
          <SkeletonBox animValue={anim} width="70%" height={14} borderRadius={7} style={styles.subtitleLine2} />
          <SkeletonBox animValue={anim} width={110} height={14} borderRadius={7} style={styles.labelSkeleton} />

          <View style={styles.phoneRow}>
            <SkeletonBox animValue={anim} width={60} height={52} borderRadius={12} />
            <SkeletonBox animValue={anim} width="100%" height={52} borderRadius={12} style={styles.phoneInput} />
          </View>

          <SkeletonBox animValue={anim} width="100%" height={52} borderRadius={12} style={styles.buttonSkeleton} />
          <SkeletonBox animValue={anim} width={60} height={14} borderRadius={7} style={styles.cancelSkeleton} />
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
    marginLeft: -1,
  },
  buttonSkeleton: {
    marginTop: 8,
  },
  cancelSkeleton: {
    alignSelf: 'center',
    marginTop: 16,
  },
});

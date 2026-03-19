/**
 * SkeletonOrderSuccessModal
 * Shimmer skeleton shown while the order-creation API call is in flight.
 * Layout mirrors OrderSuccessModal exactly.
 */

import React from 'react';
import { View, StyleSheet, Modal, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { SkeletonBox, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

interface SkeletonOrderSuccessModalProps {
  visible: boolean;
}

export const SkeletonOrderSuccessModal: React.FC<SkeletonOrderSuccessModalProps> = React.memo(({ visible }) => {
  const anim = useShimmerAnimation('pulse', visible);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.card}>
            {/* Green gradient header */}
            <LinearGradient
              colors={['#10B981', '#059669', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <SkeletonBox animValue={anim} width={64} height={64} borderRadius={32} style={styles.headerSkeleton} color="rgba(255, 255, 255, 0.25)" />
              <SkeletonBox animValue={anim} width={180} height={28} borderRadius={14} style={styles.headerTitleSkeleton} color="rgba(255, 255, 255, 0.3)" />
              <SkeletonBox animValue={anim} width={140} height={15} borderRadius={7} style={styles.headerSubtitleSkeleton} color="rgba(255, 255, 255, 0.2)" />
            </LinearGradient>

            {/* Body */}
            <View style={styles.body}>
              {/* Items + Total */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <SkeletonBox animValue={anim} width={20} height={20} borderRadius={10} />
                  <SkeletonBox animValue={anim} width={120} height={16} borderRadius={8} style={{ marginLeft: 8 }} />
                </View>
                <View style={styles.itemRow}>
                  <SkeletonBox animValue={anim} width={22} height={15} borderRadius={7} />
                  <SkeletonBox animValue={anim} width={120} height={15} borderRadius={7} style={{ marginLeft: 10, flex: 1 }} />
                  <SkeletonBox animValue={anim} width={60} height={15} borderRadius={7} />
                </View>
                <View style={[styles.itemRow, { marginTop: 10 }]}>
                  <SkeletonBox animValue={anim} width={22} height={15} borderRadius={7} />
                  <SkeletonBox animValue={anim} width={100} height={15} borderRadius={7} style={{ marginLeft: 10, flex: 1 }} />
                  <SkeletonBox animValue={anim} width={60} height={15} borderRadius={7} />
                </View>
                <View style={styles.totalRow}>
                  <SkeletonBox animValue={anim} width={42} height={17} borderRadius={8} />
                  <SkeletonBox animValue={anim} width={80} height={20} borderRadius={10} />
                </View>
              </View>

              <View style={styles.divider} />

              {/* Pickup Details */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <SkeletonBox animValue={anim} width={20} height={20} borderRadius={10} />
                  <SkeletonBox animValue={anim} width={110} height={16} borderRadius={8} style={{ marginLeft: 8 }} />
                </View>
                <View style={styles.pickupInfo}>
                  <View style={styles.pickupRow}>
                    <SkeletonBox animValue={anim} width={18} height={18} borderRadius={9} />
                    <SkeletonBox animValue={anim} width={150} height={14} borderRadius={7} style={{ marginLeft: 10 }} />
                  </View>
                  <View style={styles.pickupRow}>
                    <SkeletonBox animValue={anim} width={18} height={18} borderRadius={9} />
                    <SkeletonBox animValue={anim} width={100} height={14} borderRadius={7} style={{ marginLeft: 10 }} />
                  </View>
                  <View style={styles.pickupRow}>
                    <SkeletonBox animValue={anim} width={18} height={18} borderRadius={9} />
                    <SkeletonBox animValue={anim} width={130} height={14} borderRadius={7} style={{ marginLeft: 10 }} />
                  </View>
                </View>
              </View>
            </View>

            {/* Footer CTA */}
            <View style={styles.footer}>
              <SkeletonBox animValue={anim} width="100%" height={56} borderRadius={16} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  header: {
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerSkeleton: {},
  headerTitleSkeleton: {
    marginTop: 16,
  },
  headerSubtitleSkeleton: {
    marginTop: 6,
  },
  body: {
    padding: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },
  pickupInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});

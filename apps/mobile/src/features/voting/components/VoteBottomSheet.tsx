/**
 * VoteBottomSheet
 * Modal bottom sheet for casting a community prize vote.
 *
 * Features:
 *  - Slide-up modal overlay with semi-transparent backdrop
 *  - Scrollable prize selection list (radio-style, one choice at a time)
 *  - Prize card: image + name + description + value + selection indicator
 *  - Cast vote button: disabled until selection made, shows "Casting…" while pending
 *  - Error handling: Alert.alert for SNAPSHOT_NOT_READY and generic errors
 *  - On success: closes the sheet (mutation invalidates query → VotingCard refreshes)
 */

import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';

import { useVoteMutation } from '../hooks/useVoting';
import type { PrizeOption } from '../types/voting.types';

// ---------------------------------------------------------------------------
// Color constants (follow VotingCard pattern — no raw hex except #FFFFFF)
// ---------------------------------------------------------------------------

const TEAL = colorTokens.base.primary[500];
const SURFACE = colorTokens.base.neutral[0]; // #FFFFFF
const SURFACE_CARD = colorTokens.base.neutral[50];
const TEXT_PRIMARY = colorTokens.base.neutral[800];
const TEXT_SECONDARY = colorTokens.base.neutral[600];
const BORDER = colorTokens.base.neutral[300];
const BORDER_SELECTED_WIDTH = 2;
const DISABLED_BG = colorTokens.base.neutral[200];
const SHADOW = colorTokens.base.neutral[1000];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VoteBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  prizes: PrizeOption[];
  pointsSnapshot: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VoteBottomSheet: React.FC<VoteBottomSheetProps> = ({
  visible,
  onClose,
  prizes,
  pointsSnapshot,
}) => {
  const [selectedPrizeId, setSelectedPrizeId] = useState<string | null>(null);
  const voteMutation = useVoteMutation();

  const handleCastVote = () => {
    if (!selectedPrizeId) return;

    voteMutation.mutate(selectedPrizeId, {
      onSuccess: () => {
        setSelectedPrizeId(null);
        onClose();
      },
      onError: (error: Error) => {
        const errorWithCode = error as Error & { code?: string };
        if (errorWithCode.code === 'SNAPSHOT_NOT_READY') {
          Alert.alert('Not Ready', 'Voting is being prepared. Please try again in a few minutes.');
        } else {
          Alert.alert('Vote Failed', error.message || 'Something went wrong. Please try again.');
        }
      },
    });
  };

  const handleClose = () => {
    if (voteMutation.isPending) return; // prevent close mid-flight
    setSelectedPrizeId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
        accessibilityRole='button'
        accessibilityLabel='Close vote sheet'
      >
        {/* Sheet — inner TouchableOpacity stops backdrop tap from closing when tapping inside */}
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => undefined}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextBlock}>
              <Text variant='body' size='lg' weight='semibold' style={{ color: TEXT_PRIMARY }}>
                {'Choose the Community Prize'}
              </Text>
              <Text variant='body' size='sm' style={{ color: TEXT_SECONDARY }}>
                {`Your vote carries ${pointsSnapshot.toLocaleString()} pts`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole='button'
              accessibilityLabel='Close'
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name='close' family='Ionicons' size={24} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>

          {/* Prize list */}
          <ScrollView
            style={styles.prizeList}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.prizeListContent}
          >
            {prizes.map(prize => {
              const isSelected = selectedPrizeId === prize._id;
              return (
                <TouchableOpacity
                  key={prize._id}
                  style={[styles.prizeCard, isSelected && styles.prizeCardSelected]}
                  onPress={() => setSelectedPrizeId(prize._id)}
                  activeOpacity={0.7}
                  accessibilityRole='radio'
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${prize.name} — ${prize.value}`}
                >
                  <Image
                    source={{ uri: prize.imageUrl }}
                    style={styles.prizeImage}
                    resizeMode='cover'
                  />

                  <View style={styles.prizeInfo}>
                    <Text
                      variant='body'
                      size='md'
                      weight='semibold'
                      style={{ color: TEXT_PRIMARY }}
                    >
                      {prize.name}
                    </Text>
                    <Text
                      variant='body'
                      size='sm'
                      style={{ color: TEXT_SECONDARY }}
                      numberOfLines={2}
                    >
                      {prize.description}
                    </Text>
                    <Text variant='body' size='xs' style={{ color: TEAL }}>
                      {prize.value}
                    </Text>
                  </View>

                  {isSelected ? (
                    <Icon name='checkmark-circle' family='Ionicons' size={24} color={TEAL} />
                  ) : (
                    <View style={styles.radioUnselected} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Cast vote button */}
          <TouchableOpacity
            style={[
              styles.castButton,
              selectedPrizeId && !voteMutation.isPending
                ? styles.castButtonActive
                : styles.castButtonDisabled,
            ]}
            onPress={handleCastVote}
            disabled={!selectedPrizeId || voteMutation.isPending}
            activeOpacity={0.8}
            accessibilityRole='button'
            accessibilityLabel={
              voteMutation.isPending
                ? 'Casting your vote…'
                : `Cast my final vote (${pointsSnapshot} pts)`
            }
          >
            <Text variant='body' size='md' weight='semibold' style={styles.castButtonText}>
              {voteMutation.isPending
                ? 'Casting…'
                : `Cast My Final Vote (${pointsSnapshot.toLocaleString()} pts)`}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

VoteBottomSheet.displayName = 'VoteBottomSheet';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: SHADOW,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTextBlock: {
    flex: 1,
    gap: 4,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  prizeList: {
    flexGrow: 0,
    marginBottom: 16,
  },
  prizeListContent: {
    gap: 10,
    paddingBottom: 4,
  },
  prizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    backgroundColor: SURFACE_CARD,
  },
  prizeCardSelected: {
    borderColor: TEAL,
    borderWidth: BORDER_SELECTED_WIDTH,
    backgroundColor: colorTokens.base.primary[50],
  },
  prizeImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: BORDER,
  },
  prizeInfo: {
    flex: 1,
    gap: 3,
  },
  radioUnselected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  castButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  castButtonActive: {
    backgroundColor: TEAL,
  },
  castButtonDisabled: {
    backgroundColor: DISABLED_BG,
  },
  castButtonText: {
    color: '#FFFFFF',
  },
});

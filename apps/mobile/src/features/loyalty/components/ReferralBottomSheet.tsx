/**
 * ReferralBottomSheet
 * Bottom sheet for sharing the user's referral link.
 *
 * Actions: Copy to clipboard, native Share, WhatsApp deep-link.
 * Shows loading spinner while fetching and error state on failure.
 *
 * Rationale: Modal-based bottom sheet avoids adding a third-party
 * bottom-sheet library for a single use-case.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Share,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { Card, Icon, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';

import { loyaltyService } from '../services/loyaltyService';

// ---------------------------------------------------------------------------
// Constants (matching StreakCard palette for visual cohesion)
// ---------------------------------------------------------------------------

const SURFACE_MUTED = '#F1F5F9';
const COPIED_BG = '#D1FAE5';
const COPIED_FG = '#10B981';
const WHATSAPP_BG = '#D4EDDA';
const WHATSAPP_FG = '#25D366';
const HANDLE_COLOR = '#D1D5DB';

const SHARE_MESSAGE_PREFIX =
  'Join Too Fresh To Waste and help reduce food waste! Sign up with my link: ';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReferralBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ReferralBottomSheet: React.FC<ReferralBottomSheetProps> = ({ visible, onClose }) => {
  const theme = useTheme();
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch referral link when sheet becomes visible
  useEffect(() => {
    if (visible && !referralLink) {
      setLoading(true);
      loyaltyService
        .getReferralLink()
        .then(data => setReferralLink(data.referralLink))
        .catch(() => {
          // Error state is shown via the null referralLink fallback
        })
        .finally(() => setLoading(false));
    }
  }, [visible, referralLink]);

  // Auto-reset "Copied!" label after 2 seconds
  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [copied]);

  const handleCopy = useCallback(() => {
    if (!referralLink) return;
    Clipboard.setString(referralLink);
    setCopied(true);
  }, [referralLink]);

  const handleShare = useCallback(async () => {
    if (!referralLink) return;
    try {
      await Share.share({
        message: `${SHARE_MESSAGE_PREFIX}${referralLink}`,
      });
    } catch {
      // User cancelled or share failed — nothing to handle
    }
  }, [referralLink]);

  const handleWhatsApp = useCallback(async () => {
    if (!referralLink) return;
    const message = encodeURIComponent(`${SHARE_MESSAGE_PREFIX}${referralLink}`);
    const url = `whatsapp://send?text=${message}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  }, [referralLink]);

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
          onPress={() => {
            // Prevent dismiss when tapping inside the sheet
          }}
        >
          <View style={styles.handle} />

          <Text variant='title' size='lg' weight='bold' style={styles.title}>
            Refer &amp; Earn
          </Text>
          <Text variant='body' size='sm' color='secondary' style={styles.subtitle}>
            Share your link with friends or businesses. Earn 50 points when they get started!
          </Text>

          {loading ? (
            <ActivityIndicator size='large' color={theme.colors.primary} style={styles.loader} />
          ) : referralLink ? (
            <>
              <Card variant='outlined' style={styles.linkCard}>
                <Text
                  variant='body'
                  size='sm'
                  weight='medium'
                  numberOfLines={1}
                  style={styles.linkText}
                >
                  {referralLink}
                </Text>
              </Card>

              <View style={styles.actions}>
                {/* Copy */}
                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: copied ? COPIED_BG : SURFACE_MUTED },
                  ]}
                  onPress={handleCopy}
                  accessibilityLabel={copied ? 'Link copied' : 'Copy referral link'}
                  accessibilityRole='button'
                >
                  <Icon
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    family='Ionicons'
                    size={24}
                    color={copied ? COPIED_FG : theme.colors.onBackground}
                  />
                  <Text variant='body' size='xs' weight='medium' style={styles.actionLabel}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </Pressable>

                {/* Share */}
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: SURFACE_MUTED }]}
                  onPress={() => void handleShare()}
                  accessibilityLabel='Share referral link'
                  accessibilityRole='button'
                >
                  <Icon
                    name='share-social-outline'
                    family='Ionicons'
                    size={24}
                    color={theme.colors.onBackground}
                  />
                  <Text variant='body' size='xs' weight='medium' style={styles.actionLabel}>
                    Share
                  </Text>
                </Pressable>

                {/* WhatsApp */}
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: WHATSAPP_BG }]}
                  onPress={() => void handleWhatsApp()}
                  accessibilityLabel='Share via WhatsApp'
                  accessibilityRole='button'
                >
                  <Icon name='logo-whatsapp' family='Ionicons' size={24} color={WHATSAPP_FG} />
                  <Text variant='body' size='xs' weight='medium' style={styles.actionLabel}>
                    WhatsApp
                  </Text>
                </Pressable>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Icon
                    name='person-outline'
                    family='Ionicons'
                    size={16}
                    color={colorTokens.base.primary[500]}
                  />
                  <Text variant='body' size='xs' color='secondary' style={styles.infoText}>
                    Friend buys 10 bags in first month = +50 pts
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Icon
                    name='storefront-outline'
                    family='Ionicons'
                    size={16}
                    color={colorTokens.base.primary[500]}
                  />
                  <Text variant='body' size='xs' color='secondary' style={styles.infoText}>
                    Business sells 20 bags in first month = +50 pts
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text variant='body' size='sm' color='error' style={styles.errorText}>
              Failed to load referral link. Pull to refresh and try again.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: HANDLE_COLOR,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  loader: {
    marginVertical: 32,
  },
  linkCard: {
    padding: 8,
    marginBottom: 16,
  },
  linkText: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    minWidth: 80,
  },
  actionLabel: {
    marginTop: 4,
  },
  infoSection: {
    gap: 4,
    paddingHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    flex: 1,
  },
  errorText: {
    textAlign: 'center',
    marginVertical: 24,
  },
});

/**
 * Profile Screen
 * User profile, settings, and account management
 */

import React, { useCallback, useState, useEffect } from 'react';
import { readingGradient } from '@/utils/rtl';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SvgProps } from 'react-native-svg';

import FacebookIcon from '@/assets/social/facebook.svg';
import InstagramIcon from '@/assets/social/instagram.svg';
import LinkedInIcon from '@/assets/social/linkedin.svg';
import TikTokIcon from '@/assets/social/tiktok.svg';
import XTwitterIcon from '@/assets/social/x-twitter.svg';
import YouTubeIcon from '@/assets/social/youtube.svg';
import { Text, Button, Card, Avatar, Icon, Badge } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { logoutAsync } from '@/features/auth/store/authSlice';
import { DonationImpactCard } from '@/features/donations';
import { useLeaderboardConsent } from '@/features/leaderboard/hooks/useLeaderboardConsent';
import { getTierConfig } from '@/features/loyalty/constants/tiers';
import { useLoyalty } from '@/features/loyalty/hooks/useLoyalty';
import { useAppDispatch } from '@/hooks/redux';
import { useUserProfile } from '@/hooks/useUserProfile';
import { BiometricAuth, BiometricType } from '@/services/BiometricAuth';
import { SecureStorage } from '@/services/SecureStorage';
import { localizeBiometricName } from '@/services/biometricName';
import { Logger } from '@/utils/logger';

import type { TierName } from '@/features/loyalty/types/loyalty.types';
import type { ProfileScreenNavigationProp } from '@/navigation/types';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { useFloatingTabBarContentInset } from '@/navigation/hooks/useFloatingTabBarInset';

const { base: sp } = spacingTokens;

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

const CARD_SHADOW = '#000';
const WHITE = '#FFFFFF';
const WHITE_70 = 'rgba(255,255,255,0.7)';
const LEADERBOARD_SHADOW = '#5a42e0';
const LEADERBOARD_SUBTEXT = 'rgba(224,214,255,0.85)';

const SOCIAL_LINKS: ReadonlyArray<{
  key: string;
  /** Brand name, the same in every language. */
  name: string;
  Svg: React.FC<SvgProps>;
  url: string;
}> = [
  {
    key: 'facebook',
    name: 'Facebook',
    Svg: FacebookIcon,
    url: 'https://www.facebook.com/profile.php?id=61585767061906',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    Svg: InstagramIcon,
    url: 'https://www.instagram.com/toofreshtowaste/',
  },
  { key: 'x', name: 'X', Svg: XTwitterIcon, url: 'https://x.com/TooFresh2Waste' },
  {
    key: 'youtube',
    name: 'YouTube',
    Svg: YouTubeIcon,
    url: 'https://www.youtube.com/channel/UC_LqWpEBa-7wP5gDC2hz8Ew',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    Svg: TikTokIcon,
    url: 'https://www.tiktok.com/@toofreshtowaste',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    Svg: LinkedInIcon,
    url: 'https://www.linkedin.com/company/too-fresh-to-waste/',
  },
];

/** Upper bound on a social icon; below this the row shrinks to fit the card. */
const SOCIAL_ICON_MAX_SIZE = 42;
const SOCIAL_ICON_GAP = 8;
/**
 * Horizontal slop is capped at half the gap so neighbouring icons never claim
 * the same pixel; the vertical axis is free to grow the 44dp touch target.
 */
const SOCIAL_ICON_HIT_SLOP = {
  top: 10,
  bottom: 10,
  left: SOCIAL_ICON_GAP / 2,
  right: SOCIAL_ICON_GAP / 2,
} as const;

interface MenuItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
  badge?: string;
  showArrow?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  badge,
  showArrow = true,
  switchValue,
  onSwitchChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const theme = useTheme();
  return (
    <Pressable
      style={[
        styles.menuItem,
        { borderBottomColor: theme.colors.outlineVariant },
        disabled && styles.menuItemDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={switchValue === undefined ? 'button' : 'switch'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled,
        ...(switchValue !== undefined && { checked: switchValue }),
      }}
    >
      <View style={styles.menuItemLeft}>
        <Icon
          name={icon}
          family='Ionicons'
          size={24}
          color={disabled ? theme.colors.outlineVariant : theme.colors.onSurfaceVariant}
        />
        <Text
          variant='body'
          size='md'
          style={[styles.menuItemLabel, disabled && { color: theme.colors.outlineVariant }]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.menuItemRight}>
        {badge != null && (
          <Badge label={badge} variant='error' size='sm' style={styles.menuBadge} />
        )}
        {switchValue !== undefined && onSwitchChange && (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{
              false: theme.colors.surfaceVariant,
              true: theme.colors.primaryContainer,
            }}
            thumbColor={switchValue ? theme.colors.primary : theme.colors.outlineVariant}
            disabled={disabled}
          />
        )}
        {showArrow && switchValue === undefined && (
          <Icon
            name='chevron-forward'
            family='Ionicons'
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        )}
      </View>
    </Pressable>
  );
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  // Content runs under the absolutely-positioned tab bar, so the list has to
  // pad itself or its last row can never be scrolled clear of the shape.
  const tabBarInset = useFloatingTabBarContentInset(styles.scrollContent);
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, avatarUri, initials } = useUserProfile();

  // Biometric authentication state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(BiometricType.NONE);
  const biometricName = localizeBiometricName(BiometricAuth.getBiometricTypeName(biometricType), t);
  const [loadingBiometric, setLoadingBiometric] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Loyalty points preview — shares TanStack Query cache with LoyaltyScreen
  const { account: loyaltyAccount } = useLoyalty();
  const availablePoints = loyaltyAccount?.availablePoints ?? null;
  const currentTier: TierName = loyaltyAccount?.currentTier ?? 'Bronze';

  // Leaderboard real-name consent
  const leaderboardConsentMutation = useLeaderboardConsent();
  const showRealName = loyaltyAccount?.leaderboardConsent?.showRealName ?? false;

  /**
   * Load biometric settings on mount
   */
  useEffect(() => {
    const loadBiometricSettings = async () => {
      try {
        // Check if device supports biometric
        const supportResult = await BiometricAuth.isSupported();
        setBiometricSupported(supportResult.success);

        if (supportResult.success && supportResult.biometricType != null) {
          setBiometricType(supportResult.biometricType);
        }

        // Check if user has enabled biometric
        const enabled = await SecureStorage.isBiometricEnabled();
        setBiometricEnabled(enabled);
      } catch (error) {
        // Log the error for debugging, but don't disrupt the user flow
        Logger.error(
          'Failed to load biometric settings',
          {
            component: 'SecuritySettings',
          },
          error as Error,
        );
      } finally {
        setLoadingBiometric(false);
      }
    };

    loadBiometricSettings().catch(() => undefined);
  }, []);

  /**
   * Handle biometric toggle
   */
  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      if (value) {
        // Enabling biometric - verify first
        const authResult = await BiometricAuth.authenticate(
          t('profile.biometricPrompt', { type: biometricName }),
        );

        if (authResult.success) {
          await SecureStorage.setBiometricEnabled(true);
          setBiometricEnabled(true);
          Alert.alert(
            t('profile.biometricEnabled'),
            t('profile.biometricEnabledMessage', { type: biometricName }),
          );
        } else {
          Alert.alert(
            // The service's errorMessage is written for logs, not users.
            t('auth.biometricFailedTitle'),
            t('profile.biometricEnableFailed'),
          );
        }
      } else {
        // Disabling biometric
        Alert.alert(
          t('profile.disableBiometric'),
          t('profile.disableBiometricMessage', { type: biometricName }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('profile.disable'),
              style: 'destructive',
              onPress: () => {
                (async () => {
                  await SecureStorage.setBiometricEnabled(false);
                  setBiometricEnabled(false);
                })().catch(() => undefined);
              },
            },
          ],
        );
      }
    },
    [biometricName, t],
  );

  /**
   * Handle logout - directly logout with spinner, no confirmation
   */
  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await dispatch(logoutAsync({})).unwrap();
      // RootNavigator will automatically navigate to AuthStack
    } catch (error) {
      Logger.error('Logout failed', { component: 'ProfileScreen' }, error as Error);
      // Still redirect to login even on error - clear local state
    } finally {
      setLoggingOut(false);
    }
  }, [dispatch]);

  /**
   * Toggle leaderboard real-name visibility
   */
  const handleLeaderboardNameToggle = useCallback(
    (value: boolean) => {
      leaderboardConsentMutation.mutate(value);
    },
    [leaderboardConsentMutation],
  );

  /**
   * Navigate to edit profile
   */
  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  /**
   * Navigate to settings
   */
  const handleNavigateToSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  /**
   * Navigate to security
   */
  const handleNavigateToSecurity = useCallback(() => {
    navigation.navigate('Security');
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={tabBarInset}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('profile.a11yProfileContent')}
        accessibilityHint={t('profile.a11yProfileContentHint')}
      >
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar
              size='lg'
              {...(avatarUri ? { source: { uri: avatarUri } } : {})}
              initials={initials}
              variant='circular'
            />
            <View style={styles.profileInfo}>
              <Text variant='title' size='lg' weight='semibold' numberOfLines={1}>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text variant='body' size='sm' color='secondary' numberOfLines={1}>
                {user?.email}
              </Text>
            </View>

            {/*
             * Icon-only, on the header row rather than a full-width button
             * beneath it. That button owned an entire row plus its margins for
             * a secondary action, which is most of why this card was so tall.
             *
             * A 44dp box around a 20dp glyph, so the touch target is real
             * rather than borrowed from hitSlop. Icon-only, so it keeps an
             * accessibilityLabel for screen readers.
             */}
            <Pressable
              onPress={handleEditProfile}
              style={styles.editButton}
              accessibilityRole='button'
              accessibilityLabel={t('profile.editProfile')}
              accessibilityHint={t('profile.a11yEditProfileHint')}
              testID='profile-edit-button'
            >
              <Icon
                name='create-outline'
                family='Ionicons'
                size={20}
                color={theme.colors.primary}
              />
            </Pressable>
          </View>
        </Card>

        {/* Loyalty Points Card — navigates to full LoyaltyScreen */}
        <Pressable
          onPress={() => navigation.navigate('Loyalty')}
          android_ripple={{ color: 'rgba(0, 82, 80, 0.08)', borderless: false }}
          style={({ pressed }) => [Platform.OS === 'ios' && pressed && { opacity: 0.85 }]}
          accessibilityRole='button'
          accessibilityLabel={t('profile.myPoints')}
          accessibilityHint={t('profile.a11yMyPointsHint')}
        >
          {(() => {
            const tierConfig = getTierConfig(currentTier);
            return (
              <LinearGradient
                colors={['#005251', '#2DB89B']}
                start={readingGradient(0, 1).start}
                end={readingGradient(0, 1).end}
                style={styles.loyaltyCard}
              >
                <View style={styles.loyaltyCardLeft}>
                  <Text style={styles.loyaltyCardLabel}>{t('profile.myPoints')}</Text>
                  <Text style={styles.loyaltyCardTitle}>
                    {availablePoints !== null ? availablePoints.toLocaleString() : '--'}
                  </Text>
                  <View style={styles.loyaltyCardSubRow}>
                    <View
                      style={[styles.tierBadgePill, { backgroundColor: tierConfig.gradientStart }]}
                    >
                      <Icon name={tierConfig.icon} family='Ionicons' size={12} color='#FFFFFF' />
                      <Text variant='body' size='xs' weight='bold' style={styles.tierBadgeText}>
                        {currentTier}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.loyaltyCardRight}>
                  <Icon name='star' family='Ionicons' size={36} color='rgba(255,255,255,0.4)' />
                  <Icon
                    name='chevron-forward'
                    family='Ionicons'
                    size={20}
                    color='rgba(255,255,255,0.7)'
                    style={styles.loyaltyChevron}
                  />
                </View>
              </LinearGradient>
            );
          })()}
        </Pressable>

        {/* Leaderboard Card */}
        <Pressable
          onPress={() => navigation.navigate('Leaderboard')}
          android_ripple={{ color: 'rgba(90, 66, 224, 0.08)', borderless: false }}
          style={({ pressed }) => [Platform.OS === 'ios' && pressed && { opacity: 0.85 }]}
          accessibilityRole='button'
          accessibilityLabel={t('profile.leaderboard')}
          accessibilityHint={t('profile.a11yLeaderboardHint')}
        >
          <LinearGradient
            colors={['#8a75f8', '#5a42e0']}
            start={readingGradient(0, 1).start}
            end={readingGradient(0, 1).end}
            style={styles.leaderboardCard}
          >
            <View style={styles.leaderboardCardLeft}>
              <Text style={styles.leaderboardCardLabel}>{t('profile.community')}</Text>
              <Text style={styles.leaderboardCardTitle}>{t('profile.leaderboard')}</Text>
              <Text style={styles.leaderboardCardSub}>{t('profile.seeWhereYouRank')}</Text>
            </View>
            <View style={styles.leaderboardCardRight}>
              <Icon name='trophy' family='Ionicons' size={36} color='rgba(255,255,255,0.4)' />
              <Icon
                name='chevron-forward'
                family='Ionicons'
                size={20}
                color='rgba(255,255,255,0.7)'
                style={styles.leaderboardChevron}
              />
            </View>
          </LinearGradient>
        </Pressable>

        {/* Donation Impact Card */}
        <DonationImpactCard onPress={() => navigation.navigate('DonationImpact')} />

        {/* Menu Sections */}
        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            {t('profile.account')}
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='person-outline'
              label={t('profile.personalInfo')}
              onPress={handleEditProfile}
              accessibilityHint={t('profile.a11yPersonalInfoHint')}
            />
            <MenuItem
              icon='shield-checkmark-outline'
              label={t('profile.security')}
              onPress={handleNavigateToSecurity}
              accessibilityHint={t('profile.a11ySecurityHint')}
            />
          </View>
        </Card>

        {/* Security Settings */}
        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            {t('profile.securitySettings')}
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon={
                biometricType === BiometricType.FACE_ID ||
                biometricType === BiometricType.FACE_UNLOCK
                  ? 'scan-outline'
                  : 'finger-print-outline'
              }
              label={t('profile.biometricLogin', {
                type: biometricName,
              })}
              switchValue={biometricEnabled}
              onSwitchChange={value => {
                handleBiometricToggle(value).catch(() => undefined);
              }}
              disabled={!biometricSupported || loadingBiometric}
              accessibilityLabel={t('profile.a11ySwitchState', {
                label: t('profile.biometricLogin', { type: biometricName }),
                state: biometricEnabled ? t('profile.a11yEnabled') : t('profile.a11yDisabled'),
              })}
              accessibilityHint={t(
                biometricEnabled
                  ? 'profile.a11yBiometricDisableHint'
                  : 'profile.a11yBiometricEnableHint',
                { type: biometricName },
              )}
            />
          </View>
          {!biometricSupported && !loadingBiometric && (
            <Text variant='body' size='xs' color='secondary' style={styles.biometricHint}>
              {t('profile.biometricNotAvailable')}
            </Text>
          )}
          {biometricSupported && (
            <Text variant='body' size='xs' color='secondary' style={styles.biometricHint}>
              {t('profile.biometricHint', {
                type: biometricName,
              })}
            </Text>
          )}
        </Card>

        {/* Privacy Settings */}
        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            {t('profile.privacy')}
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='eye-outline'
              label={t('profile.useRealName')}
              switchValue={showRealName}
              onSwitchChange={handleLeaderboardNameToggle}
              disabled={leaderboardConsentMutation.isPending}
              showArrow={false}
              accessibilityLabel={t('profile.a11ySwitchState', {
                label: t('profile.useRealName'),
                state: showRealName ? t('profile.a11yEnabled') : t('profile.a11yDisabled'),
              })}
              accessibilityHint={t('profile.a11yRealNameHint')}
            />
          </View>
          <Text variant='body' size='xs' color='secondary' style={styles.biometricHint}>
            {showRealName ? t('profile.realNameVisible') : t('profile.realNameHidden')}
          </Text>
        </Card>

        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            {t('profile.preferences')}
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='settings-outline'
              label={t('profile.settings')}
              onPress={handleNavigateToSettings}
              accessibilityHint={t('profile.a11ySettingsHint')}
            />
          </View>
        </Card>

        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            {t('profile.support')}
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='chatbubble-outline'
              label={t('profile.contactSupport')}
              onPress={() => navigation.navigate('ContactSupport')}
              accessibilityHint={t('profile.a11ySupportHint')}
            />
          </View>
        </Card>

        {/* Follow Us */}
        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            {t('profile.followUs', { defaultValue: 'Follow Us' })}
          </Text>
          <View style={styles.socialRow}>
            {SOCIAL_LINKS.map(link => (
              <Pressable
                key={link.key}
                style={styles.socialIcon}
                onPress={() => {
                  Linking.openURL(link.url).catch(() => undefined);
                }}
                accessibilityRole='link'
                accessibilityLabel={t('profile.a11yFollowUs', { network: link.name })}
                accessibilityHint={t('profile.a11yFollowUsHint', { network: link.name })}
                hitSlop={SOCIAL_ICON_HIT_SLOP}
              >
                <link.Svg width='100%' height='100%' />
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Logout Button */}
        <Button
          variant='outline'
          size='lg'
          onPress={() => {
            handleLogout().catch(() => undefined);
          }}
          loading={loggingOut}
          disabled={loggingOut}
          leftIcon='log-out-outline'
          leftIconFamily='Ionicons'
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          textStyle={{ color: theme.colors.error }}
          accessibilityLabel={t('profile.logout')}
          accessibilityHint={t('profile.a11yLogoutHint')}
        >
          {t('profile.logout')}
        </Button>

        {/* App Version */}
        <Text variant='body' size='xs' color='secondary' align='center' style={styles.appVersion}>
          {t('profile.appVersion')}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    // Was sp[5] all round with a button row beneath it. The action moved onto
    // the header row, so the card is one row of content and needs far less.
    paddingHorizontal: sp[3],
    paddingVertical: sp[3],
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    // No marginBottom. Nothing follows it inside the card any more, and leaving
    // it is exactly how a removed element turns into a strip of dead space.
  },
  profileInfo: {
    flex: 1,
    marginStart: sp[3],
    // Without this a long name refuses to shrink below its own width and pushes
    // the edit control off the row - a flex default that only shows up with
    // real user data.
    minWidth: 0,
  },
  editButton: {
    // A real 44dp target rather than a 40dp box plus hitSlop. hitSlop extends
    // the touchable but not the visual, and M13 asks for the box itself where
    // there is room - there is, so this takes it.
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyCard: {
    borderRadius: 16,
    paddingHorizontal: sp[5],
    paddingVertical: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: CARD_SHADOW,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  loyaltyCardLeft: {
    flex: 1,
  },
  loyaltyCardLabel: {
    fontSize: 11,
    color: WHITE_70,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  loyaltyCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 4,
  },
  loyaltyCardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tierBadgeText: {
    color: WHITE,
    marginStart: 4,
  },
  loyaltyCardRight: {
    alignItems: 'center',
  },
  loyaltyChevron: {
    marginTop: sp[3],
  },
  leaderboardCard: {
    borderRadius: 16,
    paddingHorizontal: sp[5],
    paddingVertical: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: LEADERBOARD_SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  leaderboardCardLeft: {
    flex: 1,
  },
  leaderboardCardLabel: {
    fontSize: 11,
    color: WHITE_70,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  leaderboardCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 4,
  },
  leaderboardCardSub: {
    fontSize: 13,
    color: LEADERBOARD_SUBTEXT,
  },
  leaderboardCardRight: {
    alignItems: 'center',
  },
  leaderboardChevron: {
    marginTop: sp[3],
  },
  menuCard: {
    padding: 16,
    marginBottom: 16,
  },
  menuTitle: {
    marginBottom: 8,
  },
  menuList: {
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sp[3],
    borderBottomWidth: 1,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemLabel: {
    marginStart: sp[3],
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadge: {
    marginEnd: 8,
  },
  biometricHint: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  // The six icons must survive any screen width. A fixed 42dp box × 6 plus gaps
  // is 322dp, wider than the card's inner width on a 360dp device (296dp), and
  // Card omits overflow:'hidden' on Android on purpose — so the row spilled past
  // the card edges. flex:1 lets each cell shrink to the space that exists and
  // maxWidth stops them inflating past the intended size on tablets.
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SOCIAL_ICON_GAP,
    marginTop: sp[3],
    paddingVertical: 4,
  },
  socialIcon: {
    flex: 1,
    maxWidth: SOCIAL_ICON_MAX_SIZE,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  logoutButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  appVersion: {
    marginTop: 16,
  },
});

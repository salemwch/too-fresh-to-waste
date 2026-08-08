/**
 * Profile Screen
 * User profile, settings, and account management
 */

import React, { useCallback, useState, useEffect } from 'react';
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
import { Logger } from '@/utils/logger';

import type { TierName } from '@/features/loyalty/types/loyalty.types';
import type { ProfileScreenNavigationProp } from '@/navigation/types';

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
  Svg: React.FC<SvgProps>;
  url: string;
}> = [
  {
    key: 'facebook',
    Svg: FacebookIcon,
    url: 'https://www.facebook.com/profile.php?id=61585767061906',
  },
  {
    key: 'instagram',
    Svg: InstagramIcon,
    url: 'https://www.instagram.com/toofreshtowaste/',
  },
  { key: 'x', Svg: XTwitterIcon, url: 'https://x.com/TooFresh2Waste' },
  {
    key: 'youtube',
    Svg: YouTubeIcon,
    url: 'https://www.youtube.com/channel/UC_LqWpEBa-7wP5gDC2hz8Ew',
  },
  {
    key: 'tiktok',
    Svg: TikTokIcon,
    url: 'https://www.tiktok.com/@toofreshtowaste',
  },
  {
    key: 'linkedin',
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
        { borderBottomColor: theme.colors.outline },
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
          color={disabled ? theme.colors.outline : theme.colors.onSurfaceVariant}
        />
        <Text
          variant='body'
          size='md'
          style={[styles.menuItemLabel, disabled && { color: theme.colors.outline }]}
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
            thumbColor={switchValue ? theme.colors.primary : theme.colors.outline}
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
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user, avatarUri, initials } = useUserProfile();

  // Biometric authentication state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(BiometricType.NONE);
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
          `Enable ${BiometricAuth.getBiometricTypeName(biometricType)} for quick login`,
        );

        if (authResult.success) {
          await SecureStorage.setBiometricEnabled(true);
          setBiometricEnabled(true);
          Alert.alert(
            'Biometric Enabled',
            `${BiometricAuth.getBiometricTypeName(biometricType)} authentication has been enabled for this device.`,
          );
        } else {
          Alert.alert(
            'Authentication Failed',
            authResult.errorMessage ?? 'Failed to enable biometric authentication.',
          );
        }
      } else {
        // Disabling biometric
        Alert.alert(
          'Disable Biometric',
          `Are you sure you want to disable ${BiometricAuth.getBiometricTypeName(biometricType)} authentication?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
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
    [biometricType],
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('profile.a11yProfileContent')}
        accessibilityHint={t('profile.a11yProfileContentHint')}
      >
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar
              size='xl'
              {...(avatarUri ? { source: { uri: avatarUri } } : {})}
              initials={initials}
              variant='circular'
            />
            <View style={styles.profileInfo}>
              <Text variant='title' size='lg' weight='semibold'>
                {user?.firstName} {user?.lastName}
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                {user?.email}
              </Text>
            </View>
          </View>

          <Button
            variant='outline'
            size='sm'
            onPress={handleEditProfile}
            leftIcon='create-outline'
            leftIconFamily='Ionicons'
            style={styles.editButton}
            accessibilityLabel={t('profile.editProfile')}
            accessibilityHint={t('profile.a11yEditProfileHint')}
          >
            {t('profile.editProfile')}
          </Button>
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
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
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
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
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
                type: BiometricAuth.getBiometricTypeName(biometricType),
              })}
              switchValue={biometricEnabled}
              onSwitchChange={value => {
                handleBiometricToggle(value).catch(() => undefined);
              }}
              disabled={!biometricSupported || loadingBiometric}
              accessibilityLabel={`${BiometricAuth.getBiometricTypeName(biometricType)} login, ${biometricEnabled ? 'enabled' : 'disabled'}`}
              accessibilityHint={`Double tap to ${biometricEnabled ? 'disable' : 'enable'} ${BiometricAuth.getBiometricTypeName(biometricType)} authentication`}
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
                type: BiometricAuth.getBiometricTypeName(biometricType),
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
              accessibilityLabel={`Use my real name on leaderboard, ${showRealName ? 'enabled' : 'disabled'}`}
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
                accessibilityLabel={`Follow us on ${link.key}`}
                accessibilityHint={`Opens ${link.key} in your browser or app`}
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
    padding: 20,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileInfo: {
    flex: 1,
    marginStart: 16,
  },
  editButton: {
    marginTop: 4,
    borderRadius: 9999,
  },
  loyaltyCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
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
    marginTop: 12,
  },
  leaderboardCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
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
    marginTop: 12,
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
    paddingVertical: 12,
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
    marginStart: 12,
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
    marginTop: 12,
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

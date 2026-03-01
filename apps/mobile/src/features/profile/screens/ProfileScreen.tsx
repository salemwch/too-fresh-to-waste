/**
 * Profile Screen
 * User profile, settings, and account management
 */

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Pressable,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Button, Card, Avatar, Icon, Badge } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { logoutAsync } from '@/features/auth/store/authSlice';
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

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user, avatarUri, initials } = useUserProfile();

  // Biometric authentication state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(BiometricType.NONE);
  const [loadingBiometric, setLoadingBiometric] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Loyalty points preview — shares React Query cache with LoyaltyScreen
  const { account: loyaltyAccount } = useLoyalty();
  const availablePoints = loyaltyAccount?.availablePoints ?? null;
  const currentTier: TierName = loyaltyAccount?.currentTier ?? 'Bronze';

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

    void loadBiometricSettings();
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
                void (async () => {
                  await SecureStorage.setBiometricEnabled(false);
                  setBiometricEnabled(false);
                })();
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

  /**
   * Menu item component
   */
  const MenuItem = ({
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
  }: {
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
  }) => (
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessibilityLabel='Profile screen content'
        accessibilityHint='Scroll to view your profile, settings, and account options'
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
            size='md'
            onPress={handleEditProfile}
            leftIcon='create-outline'
            leftIconFamily='Ionicons'
            style={styles.editButton}
            accessibilityLabel='Edit profile'
            accessibilityHint='Opens profile editing screen to update your information'
          >
            Edit Profile
          </Button>
        </Card>

        {/* Loyalty Points Card — navigates to full LoyaltyScreen */}
        <Pressable
          onPress={() => navigation.navigate('Loyalty')}
          android_ripple={{ color: 'rgba(0, 82, 80, 0.08)', borderless: false }}
          style={({ pressed }) => [Platform.OS === 'ios' && pressed && { opacity: 0.85 }]}
          accessibilityRole='button'
          accessibilityLabel='My Points'
          accessibilityHint='Tap to view your loyalty points and rewards'
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
                <View style={styles.loyaltyCardTop}>
                  <View>
                    <Text variant='body' size='sm' style={styles.loyaltyLabel}>
                      My Points
                    </Text>
                    <Text variant='headline' size='lg' weight='bold' style={styles.loyaltyPoints}>
                      {availablePoints !== null ? availablePoints.toLocaleString() : '--'}
                    </Text>
                  </View>
                  <View
                    style={[styles.tierBadgePill, { backgroundColor: tierConfig.gradientStart }]}
                  >
                    <Icon name={tierConfig.icon} family='Ionicons' size={14} color='#FFFFFF' />
                    <Text variant='body' size='xs' weight='bold' style={styles.tierBadgeText}>
                      {currentTier}
                    </Text>
                  </View>
                </View>

                {/* Tap hint row */}
                <View style={styles.tapHintRow}>
                  <Text variant='body' size='xs' style={styles.tapHintText}>
                    Tap to view rewards
                  </Text>
                  <Icon
                    name='chevron-forward'
                    family='Ionicons'
                    size={16}
                    color='rgba(255,255,255,0.7)'
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
          accessibilityLabel='Leaderboard'
          accessibilityHint='Tap to view the community leaderboard'
        >
          <LinearGradient
            colors={['#8a75f8', '#5a42e0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.leaderboardCard}
          >
            <View style={styles.leaderboardCardLeft}>
              <Text style={styles.leaderboardCardLabel}>Community</Text>
              <Text style={styles.leaderboardCardTitle}>Leaderboard</Text>
              <Text style={styles.leaderboardCardSub}>See where you rank</Text>
            </View>
            <View style={styles.leaderboardCardRight}>
              <Icon name='trophy' family='Ionicons' size={36} color='rgba(255,255,255,0.4)' />
              <Icon
                name='chevron-forward'
                family='Ionicons'
                size={20}
                color='rgba(255,255,255,0.7)'
                style={{ marginTop: 12 }}
              />
            </View>
          </LinearGradient>
        </Pressable>

        {/* Menu Sections */}
        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            Account
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='person-outline'
              label='Personal Information'
              onPress={handleEditProfile}
              accessibilityHint='Edit your personal details and contact information'
            />
            <MenuItem
              icon='shield-checkmark-outline'
              label='Security'
              onPress={handleNavigateToSecurity}
              accessibilityHint='Manage password and security settings'
            />
            <MenuItem
              icon='trophy-outline'
              label='Leaderboard'
              onPress={() => navigation.navigate('Leaderboard')}
              accessibilityHint='View the community loyalty points leaderboard'
            />
          </View>
        </Card>

        {/* Security Settings */}
        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            Security Settings
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon={
                biometricType === BiometricType.FACE_ID ||
                biometricType === BiometricType.FACE_UNLOCK
                  ? 'scan-outline'
                  : 'finger-print-outline'
              }
              label={`${BiometricAuth.getBiometricTypeName(biometricType)} Login`}
              switchValue={biometricEnabled}
              onSwitchChange={value => {
                void handleBiometricToggle(value);
              }}
              disabled={!biometricSupported || loadingBiometric}
              accessibilityLabel={`${BiometricAuth.getBiometricTypeName(biometricType)} login, ${biometricEnabled ? 'enabled' : 'disabled'}`}
              accessibilityHint={`Double tap to ${biometricEnabled ? 'disable' : 'enable'} ${BiometricAuth.getBiometricTypeName(biometricType)} authentication`}
            />
          </View>
          {!biometricSupported && !loadingBiometric && (
            <Text variant='body' size='xs' color='secondary' style={styles.biometricHint}>
              Biometric authentication is not available on this device
            </Text>
          )}
          {biometricSupported && (
            <Text variant='body' size='xs' color='secondary' style={styles.biometricHint}>
              Use {BiometricAuth.getBiometricTypeName(biometricType)} for quick and secure login
            </Text>
          )}
        </Card>

        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            Preferences
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='settings-outline'
              label='Settings'
              onPress={handleNavigateToSettings}
              accessibilityHint='Access app settings and preferences'
            />
          </View>
        </Card>

        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            Support
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='chatbubble-outline'
              label='Contact Support'
              onPress={() => {}}
              accessibilityHint='Get help from our support team'
            />
          </View>
        </Card>

        {/* Logout Button */}
        <Button
          variant='outline'
          size='lg'
          onPress={() => void handleLogout()}
          loading={loggingOut}
          disabled={loggingOut}
          leftIcon='log-out-outline'
          leftIconFamily='Ionicons'
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          textStyle={{ color: theme.colors.error }}
          accessibilityLabel='Logout'
          accessibilityHint='Sign out of your account'
        >
          Logout
        </Button>

        {/* App Version */}
        <Text variant='body' size='xs' color='secondary' align='center' style={styles.appVersion}>
          Food Waste Marketplace v1.0.0
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
    marginBottom: 16,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  editButton: {
    marginTop: 8,
  },
  loyaltyCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  loyaltyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltyLabel: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  loyaltyPoints: {
    color: '#FFFFFF',
  },
  tierBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tierBadgeText: {
    color: '#FFFFFF',
    marginLeft: 5,
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: 10,
  },
  tapHintText: {
    color: 'rgba(255,255,255,0.7)',
    marginRight: 4,
  },
  leaderboardCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#5a42e0',
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
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  leaderboardCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  leaderboardCardSub: {
    fontSize: 13,
    color: 'rgba(224,214,255,0.85)',
  },
  leaderboardCardRight: {
    alignItems: 'center',
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
    marginLeft: 12,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBadge: {
    marginRight: 8,
  },
  biometricHint: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  logoutButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  appVersion: {
    marginTop: 16,
  },
});

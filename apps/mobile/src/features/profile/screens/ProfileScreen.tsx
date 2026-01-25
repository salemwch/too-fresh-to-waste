/**
 * Profile Screen
 * User profile, settings, and account management
 */

import React, { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';

import { Text, Button, Card, Avatar, Icon, Badge } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { logoutAsync } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { BiometricAuth, BiometricType } from '@/services/BiometricAuth';
import { SecureStorage } from '@/services/SecureStorage';
import { Logger } from '@/utils/logger';

import type { ProfileScreenNavigationProp } from '@/navigation/types';
interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user, isLoading } = useAppSelector(state => state.auth);

  // Biometric authentication state
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(BiometricType.NONE);
  const [loadingBiometric, setLoadingBiometric] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

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
      await dispatch(logoutAsync()).unwrap();
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
   * Navigate to privacy
   */
  const handleNavigateToPrivacy = useCallback(() => {
    navigation.navigate('Privacy');
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
    <TouchableOpacity
      style={[
        styles.menuItem,
        { borderBottomColor: theme.colors.outline },
        disabled && styles.menuItemDisabled,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
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
    </TouchableOpacity>
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
              initials={
                user?.firstName != null && user?.lastName
                  ? `${user.firstName[0]}${user.lastName[0]}`
                  : 'U'
              }
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

        {/* Stats Card */}
        <Card style={styles.statsCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
            My Impact
          </Text>
          <View style={styles.statsGrid}>
            <View
              style={styles.statItem}
              accessibilityLabel='Total orders: 0'
              accessibilityHint='Number of orders you have placed'
            >
              <Text variant='headline' size='lg' weight='bold' color='primary'>
                0
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                Orders
              </Text>
            </View>
            <View
              style={styles.statItem}
              accessibilityLabel='Money saved: $0'
              accessibilityHint='Total amount of money you have saved'
            >
              <Text variant='headline' size='lg' weight='bold' color='success'>
                $0
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                Saved
              </Text>
            </View>
            <View
              style={styles.statItem}
              accessibilityLabel='CO2 saved: 0 kilograms'
              accessibilityHint='Carbon dioxide emissions prevented'
            >
              <Text
                variant='headline'
                size='lg'
                weight='bold'
                style={{ color: theme.colors.warning }}
              >
                0kg
              </Text>
              <Text variant='body' size='sm' color='secondary'>
                CO₂ Saved
              </Text>
            </View>
          </View>
        </Card>

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
              icon='lock-closed-outline'
              label='Privacy'
              onPress={handleNavigateToPrivacy}
              accessibilityHint='Control your privacy and data settings'
            />
            <MenuItem
              icon='notifications-outline'
              label='Notifications'
              onPress={handleNavigateToSettings}
              badge='3'
              accessibilityLabel='Notifications, 3 unread'
              accessibilityHint='Manage notification preferences'
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
            <MenuItem
              icon='globe-outline'
              label='Language'
              onPress={handleNavigateToSettings}
              accessibilityHint='Change app language'
            />
            <MenuItem
              icon='moon-outline'
              label='Dark Mode'
              onPress={handleNavigateToSettings}
              accessibilityHint='Toggle dark mode theme'
            />
          </View>
        </Card>

        <Card style={styles.menuCard}>
          <Text variant='title' size='md' weight='semibold' style={styles.menuTitle}>
            Support
          </Text>
          <View style={styles.menuList}>
            <MenuItem
              icon='help-circle-outline'
              label='Help Center'
              onPress={() => {}}
              accessibilityHint='Access help articles and FAQs'
            />
            <MenuItem
              icon='chatbubble-outline'
              label='Contact Support'
              onPress={() => {}}
              accessibilityHint='Get help from our support team'
            />
            <MenuItem
              icon='document-text-outline'
              label='Terms & Conditions'
              onPress={() => {}}
              accessibilityHint='Read terms and conditions'
            />
            <MenuItem
              icon='information-circle-outline'
              label='About'
              onPress={() => {}}
              accessibilityHint='Learn more about this app'
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
  statsCard: {
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
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

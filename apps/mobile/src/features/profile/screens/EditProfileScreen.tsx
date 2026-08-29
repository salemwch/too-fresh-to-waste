/**
 * Edit Profile Screen
 *
 * - Form validation (react-hook-form + yup)
 * - Optimistic updates
 * - Error handling
 * - Image upload
 * - Accessibility
 * - Loading states
 *
 * UX Best Practices:
 * - Clear section headers
 * - Inline validation errors
 * - Confirmation on discard
 * - Success feedback
 * - Keyboard-aware scroll view
 */

import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  StyleSheet,
  ScrollView,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import * as yup from 'yup';

import { Text, Button, Card, Avatar, Icon, Input } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { authKeys } from '@/features/auth/queryKeys';
import { updateProfileAsync, updateUser } from '@/features/auth/store/authSlice';
import { SkeletonEditProfileScreen } from '@/features/profile/components/SkeletonEditProfileScreen';
import { userService } from '@/features/profile/services/userService';
import { useAppDispatch } from '@/hooks/redux';
import { useUserProfile } from '@/hooks/useUserProfile';
import { SecureStorage } from '@/services/SecureStorage';
import { Logger } from '@/utils/logger';
import { showSuccessToast } from '@/utils/toast';

import type { EditProfileScreenNavigationProp } from '@/navigation/types';
import type { InferType } from 'yup';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

interface EditProfileScreenProps {
  navigation: EditProfileScreenNavigationProp;
}

// ============================================================================
// Validation Schema
// ============================================================================

const profileSchema = yup.object().shape({
  firstName: yup
    .string()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters')
    .matches(
      /^[a-zA-Z\s'-]+$/,
      'First name can only contain letters, spaces, hyphens, and apostrophes',
    ),

  lastName: yup
    .string()
    .required('Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters')
    .matches(
      /^[a-zA-Z\s'-]+$/,
      'Last name can only contain letters, spaces, hyphens, and apostrophes',
    ),

  phoneNumber: yup
    .string()
    .nullable()
    .matches(
      /^(\+\d{1,3}[- ]?)?\d{8,15}$/,
      'Phone number must be a valid international format (e.g., +21612345678)',
    ),

  // Address fields
  street: yup.string().nullable().max(100, 'Street address must not exceed 100 characters'),

  city: yup.string().nullable().max(50, 'City must not exceed 50 characters'),

  postalCode: yup
    .string()
    .nullable()
    .matches(/^[0-9]{4,10}$/, 'Postal code must be 4-10 digits'),

  country: yup.string().nullable().max(50, 'Country must not exceed 50 characters'),
});

// Derive type from Yup schema for better type inference with yupResolver
type ProfileFormData = InferType<typeof profileSchema>;

// Component

/**
 * Section header row.
 *
 * Hoisted to module scope rather than declared inside EditProfileScreen: a
 * component defined in a render body gets a new type identity every render, so
 * React unmounts and remounts its whole subtree instead of updating it. It reads
 * the theme itself rather than closing over the parent's.
 */
const SectionHeader: React.FC<{ title: string; icon: string }> = ({ title, icon }) => {
  const theme = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Icon name={icon} family='Ionicons' size={20} color={theme.colors.primary} />
      <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
        {title}
      </Text>
    </View>
  );
};

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { user, avatarUri, initials } = useUserProfile();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize form with current user data
  // Extract address with type suppression for optional nested property
  const userAddress = user?.address;

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phoneNumber: user?.phoneNumber ?? null,
      street: userAddress?.street ?? null,
      city: userAddress?.city ?? null,
      postalCode: userAddress?.postalCode ?? null,
      country: userAddress?.country ?? null,
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  /**
   * Handle profile image selection
   */
  const handleSelectImage = useCallback(() => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: false,
      },
      (response: ImagePickerResponse) => {
        if (response.didCancel === true) {
          Logger.info('User cancelled image picker');
          return;
        }

        if (response.errorCode) {
          Logger.error('ImagePicker Error', {
            code: response.errorCode,
            message: response.errorMessage,
          });
          Alert.alert('Error', response.errorMessage ?? 'Failed to select image');
          return;
        }

        if (response.assets?.[0]) {
          const asset = response.assets[0];
          setImageUri(asset.uri ?? null);
          Logger.info('Profile image selected', { uri: asset.uri });
        }
      },
    );
  }, []);

  // Ref to hold validated form data between render frames
  const pendingDataRef = useRef<ProfileFormData | null>(null);

  /**
   * Perform the actual save (called AFTER skeleton is visible)
   */
  const performSave = useCallback(
    async (data: ProfileFormData) => {
      try {
        Logger.info('Submitting profile update', { fields: Object.keys(data) });

        // Build update payload - only include changed fields
        const updates: Record<string, unknown> = {};
        if (data.firstName !== user?.firstName) updates['firstName'] = data.firstName;
        if (data.lastName !== user?.lastName) updates['lastName'] = data.lastName;
        if (data.phoneNumber !== user?.phoneNumber)
          updates['phoneNumber'] = data.phoneNumber ?? undefined;

        // Check for address changes
        const currentAddress = user?.address;
        const hasAddressChanges =
          (data.street ?? '') !== (currentAddress?.street ?? '') ||
          (data.city ?? '') !== (currentAddress?.city ?? '') ||
          (data.postalCode ?? '') !== (currentAddress?.postalCode ?? '') ||
          (data.country ?? '') !== (currentAddress?.country ?? '');

        if (hasAddressChanges) {
          const hasAddressData =
            (data.street != null && data.street !== '') ||
            (data.city != null && data.city !== '') ||
            (data.postalCode != null && data.postalCode !== '') ||
            (data.country != null && data.country !== '');

          if (hasAddressData) {
            updates['address'] = {
              street: data.street ?? '',
              city: data.city ?? '',
              postalCode: data.postalCode ?? '',
              country: data.country ?? '',
            };
          }
        }

        // If no changes, restore form
        if (Object.keys(updates).length === 0 && imageUri == null) {
          setIsSaving(false);
          return;
        }

        // Update profile fields
        if (Object.keys(updates).length > 0) {
          await dispatch(updateProfileAsync(updates)).unwrap();

          // Redux and Keychain were updated in place by the thunk, but the
          // ['auth','me'] cache still holds the pre-edit profile. Without this
          // the screens now reading useCurrentUser would show stale data until
          // its staleTime elapsed.
          void queryClient.invalidateQueries({ queryKey: authKeys.me() });
          Logger.info('Profile fields updated successfully', { userId: user?.userId });
        }

        // Handle image upload
        if (imageUri != null) {
          setIsImageUploading(true);
          try {
            const uploadResult = await userService.uploadProfileImage(imageUri);

            const imageUpdate = {
              avatar: uploadResult.profileImage,
              profileImage: uploadResult.profileImage,
            };
            dispatch(updateUser(imageUpdate));
            void queryClient.invalidateQueries({ queryKey: authKeys.me() });

            if (user != null) {
              const persistedUser = { ...user, ...imageUpdate };
              await SecureStorage.setUserData(JSON.stringify(persistedUser));
            }

            Logger.info('Profile image uploaded successfully', {
              userId: user?.userId,
              imageUrl: uploadResult.profileImage,
            });
          } catch (uploadError) {
            Logger.error('Failed to upload profile image', {}, uploadError as Error);
            throw new Error('Failed to upload profile image. Please try again.');
          } finally {
            setIsImageUploading(false);
          }
        }

        // Success: reset form with fresh data, stay on screen
        setImageUri(null);
        reset({
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
          street: data.street,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country,
        });

        setSaveError(null);
        showSuccessToast('Profile updated', 'Your changes have been saved');
        Logger.info('Profile updated successfully', { userId: user?.userId });
      } catch (error) {
        Logger.error('Failed to update profile', {}, error as Error);
        setSaveError('Failed to update profile. Please try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [dispatch, queryClient, user, imageUri, reset],
  );

  /**
   * Handle save button press
   *
   * Two-phase approach to guarantee skeleton renders:
   * 1. Validate form → set isSaving=true → React renders skeleton
   * 2. After render frame completes → start async network work
   *
   * Without this split, React 18 batches setIsSaving(true) and
   * setIsSaving(false) into a single render, skipping the skeleton.
   */
  const handleSave = useCallback(() => {
    void handleSubmit((data: ProfileFormData) => {
      // Store validated data and flip to skeleton
      pendingDataRef.current = data;
      setIsSaving(true);

      // Wait for the skeleton to render, then start async work
      InteractionManager.runAfterInteractions(() => {
        const savedData = pendingDataRef.current;
        pendingDataRef.current = null;
        if (savedData != null) {
          void performSave(savedData);
        }
      });
    })();
  }, [handleSubmit, performSave]);

  /**
   * Handle cancel with unsaved changes confirmation
   */
  const handleCancel = useCallback(() => {
    if (isDirty || imageUri != null) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              reset();
              setImageUri(null);
              navigation.goBack();
            },
          },
        ],
      );
    } else {
      navigation.goBack();
    }
  }, [isDirty, imageUri, navigation, reset]);

  // Show skeleton while saving
  if (isSaving) {
    return <SkeletonEditProfileScreen />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
      >
        {/* Profile Image Section */}
        <Card style={styles.card}>
          <View style={styles.avatarSection}>
            <Avatar
              size='xl'
              source={{ uri: imageUri ?? avatarUri ?? '' }}
              initials={initials}
              variant='circular'
            />
            <Pressable
              style={[styles.changePhotoButton, { backgroundColor: theme.colors.primaryContainer }]}
              onPress={handleSelectImage}
              disabled={isImageUploading}
              accessibilityLabel={t('profile.a11yChangePhoto')}
              accessibilityHint={t('profile.a11yChangePhotoHint')}
            >
              <Icon
                name='camera-outline'
                family='Ionicons'
                size={16}
                color={theme.colors.primary}
              />
              <Text
                variant='label'
                size='sm'
                weight='medium'
                color='primary'
                style={styles.changePhotoText}
              >
                {isImageUploading ? 'Uploading...' : 'Change Photo'}
              </Text>
            </Pressable>
            {imageUri != null && !isImageUploading && (
              <Text variant='body' size='xs' color='success' style={styles.imageStatusText}>
                New image selected
              </Text>
            )}
            {isImageUploading && (
              <Text variant='body' size='xs' color='primary' style={styles.imageStatusText}>
                Uploading image...
              </Text>
            )}
          </View>
        </Card>

        {/* Personal Information Section */}
        <Card style={styles.card}>
          <SectionHeader title={t('profile.personalInformation')} icon='person-outline' />

          <Controller
            control={control}
            name='firstName'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('profile.firstName')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.firstName?.message}
                placeholder={t('profile.a11yFirstNameHint')}
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel={t('profile.a11yFirstNameInput')}
                accessibilityHint={t('profile.a11yFirstNameHint')}
              />
            )}
          />

          <Controller
            control={control}
            name='lastName'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('profile.lastName')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.lastName?.message}
                placeholder={t('profile.a11yLastNameHint')}
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel={t('profile.a11yLastNameInput')}
                accessibilityHint={t('profile.a11yLastNameHint')}
              />
            )}
          />

          <Input
            label={t('profile.email')}
            value={user?.email ?? ''}
            editable={false}
            placeholder={t('profile.emailPlaceholder')}
            keyboardType='email-address'
            leftIcon='mail-outline'
            leftIconFamily='Ionicons'
            style={[styles.disabledInput, { backgroundColor: theme.colors.surfaceVariant }]}
            accessibilityLabel={t('profile.a11yEmailReadOnly')}
            accessibilityHint={t('profile.a11yEmailReadOnlyHint')}
          />

          <Controller
            control={control}
            name='phoneNumber'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('profile.phoneNumber')}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phoneNumber?.message}
                placeholder={t('profile.phonePlaceholder')}
                keyboardType='phone-pad'
                leftIcon='call-outline'
                leftIconFamily='Ionicons'
                accessibilityLabel={t('profile.a11yPhoneInput')}
                accessibilityHint={t('profile.a11yPhoneHint')}
              />
            )}
          />
        </Card>

        {/* Address Section */}
        <Card style={styles.card}>
          <SectionHeader title={t('profile.address')} icon='location-outline' />

          <Controller
            control={control}
            name='street'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('profile.streetAddress')}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.street?.message}
                placeholder={t('profile.streetPlaceholder')}
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel={t('profile.a11yStreetInput')}
                accessibilityHint={t('profile.a11yStreetHint')}
              />
            )}
          />

          <Controller
            control={control}
            name='city'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label={t('profile.city')}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.city?.message}
                placeholder={t('profile.cityPlaceholder')}
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel={t('profile.a11yCityInput')}
                accessibilityHint={t('profile.a11yCityHint')}
              />
            )}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Controller
                control={control}
                name='postalCode'
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('profile.postalCode')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.postalCode?.message}
                    placeholder={t('profile.postalPlaceholder')}
                    keyboardType='number-pad'
                    returnKeyType='next'
                    accessibilityLabel={t('profile.a11yPostalInput')}
                    accessibilityHint={t('profile.a11yPostalHint')}
                  />
                )}
              />
            </View>

            <View style={styles.halfWidth}>
              <Controller
                control={control}
                name='country'
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('profile.country')}
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.country?.message}
                    placeholder={t('profile.countryPlaceholder')}
                    autoCapitalize='words'
                    returnKeyType='done'
                    accessibilityLabel={t('profile.a11yCountryInput')}
                    accessibilityHint={t('profile.a11yCountryHint')}
                  />
                )}
              />
            </View>
          </View>
        </Card>

        {/* Inline save error */}
        {saveError !== null && (
          <View
            style={[
              styles.inlineError,
              {
                backgroundColor: theme.colors.errorContainer ?? '#FEE2E2',
                borderColor: theme.colors.error,
              },
            ]}
          >
            <Icon
              name='alert-circle-outline'
              family='Ionicons'
              size={16}
              color={theme.colors.onErrorContainer}
            />
            <Text
              variant='body'
              size='sm'
              style={[styles.inlineErrorText, { color: theme.colors.onErrorContainer }]}
            >
              {saveError}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            variant='primary'
            size='lg'
            onPress={handleSave}
            disabled={!isDirty && imageUri == null}
            style={styles.saveButton}
            accessibilityLabel={t('profile.a11ySaveChanges')}
            accessibilityHint={t('profile.a11ySaveChangesHint')}
          >
            Save Changes
          </Button>

          <Button
            variant='outline'
            size='md'
            onPress={handleCancel}
            accessibilityLabel={t('profile.a11yCancelEditing')}
            accessibilityHint={t('profile.a11yCancelEditingHint')}
          >
            Cancel
          </Button>
        </View>

        {/* Helper Info */}
        <View style={styles.infoBox}>
          <Icon
            name='information-circle-outline'
            family='Ionicons'
            size={20}
            color={theme.colors.primary}
          />
          <Text variant='body' size='xs' color='secondary' style={styles.infoText}>
            Your personal information is securely stored and will only be used for order delivery
            and account management.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Static half of the error row; the colour stays inline because it is
  // theme-dependent and cannot live in a static StyleSheet.
  inlineErrorText: { flex: 1 },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    padding: sp[5],
    marginBottom: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: sp[3],
  },
  changePhotoText: {
    marginStart: 4,
  },
  imageStatusText: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    marginStart: 8,
  },
  disabledInput: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: sp[3],
  },
  halfWidth: {
    flex: 1,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: sp[3],
    marginTop: 8,
    gap: 8,
  },
  buttonContainer: {
    marginTop: 8,
  },
  saveButton: {
    marginBottom: sp[3],
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: sp[3],
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.05)', // Light blue background for info box
  },
  infoText: {
    flex: 1,
    marginStart: 8,
    lineHeight: 18,
  },
});

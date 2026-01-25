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
import React, { useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import * as yup from 'yup';

import { Text, Button, Card, Avatar, Icon, Input } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { updateProfileAsync, updateUser } from '@/features/auth/store/authSlice';
import { userService } from '@/features/profile/services/userService';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { Logger } from '@/utils/logger';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { InferType } from 'yup';

type EditProfileScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'EditProfile'>;

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

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { user, isLoading } = useAppSelector(state => state.auth);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);

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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

  /**
   * Handle form submission
   */
  const onSubmit = useCallback(
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
          // Only include address if at least one field has a value
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

        // If no changes, just go back
        if (Object.keys(updates).length === 0 && imageUri == null) {
          Alert.alert('No Changes', 'No changes were made to your profile.');
          return;
        }

        // Update profile fields if there are any changes
        if (Object.keys(updates).length > 0) {
          await dispatch(updateProfileAsync(updates)).unwrap();
          Logger.info('Profile fields updated successfully', { userId: user?.userId });
        }

        // Handle image upload if imageUri exists
        if (imageUri != null) {
          setIsImageUploading(true);
          try {
            const uploadResult = await userService.uploadProfileImage(imageUri);

            // Update user in Redux with new avatar URL
            dispatch(
              updateUser({
                avatar: uploadResult.profileImage,
              }),
            );

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

        // Success feedback
        Alert.alert('Success', 'Your profile has been updated successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);

        Logger.info('Profile updated successfully', { userId: user?.userId });
      } catch (error) {
        Logger.error('Failed to update profile', {}, error as Error);
        Alert.alert(
          'Update Failed',
          error instanceof Error ? error.message : 'Failed to update profile. Please try again.',
        );
      }
    },
    [dispatch, user, imageUri, navigation],
  );

  /**
   * Handle save button press
   */
  const handleSave = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

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

  /**
   * Section Header Component
   */
  const SectionHeader: React.FC<{ title: string; icon: string }> = ({ title, icon }) => (
    <View style={styles.sectionHeader}>
      <Icon name={icon} family='Ionicons' size={20} color={theme.colors.primary} />
      <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
        {title}
      </Text>
    </View>
  );

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
              source={{ uri: imageUri ?? user?.avatar ?? '' }}
              initials={
                user?.firstName != null && user?.lastName != null
                  ? `${user.firstName[0]}${user.lastName[0]}`
                  : 'U'
              }
              variant='circular'
            />
            <TouchableOpacity
              style={[styles.changePhotoButton, { backgroundColor: theme.colors.primaryContainer }]}
              onPress={handleSelectImage}
              disabled={isImageUploading || isLoading}
              accessibilityLabel='Change profile photo'
              accessibilityHint='Opens image picker to select a new profile photo'
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
            </TouchableOpacity>
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
          <SectionHeader title='Personal Information' icon='person-outline' />

          <Controller
            control={control}
            name='firstName'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='First Name'
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.firstName?.message}
                placeholder='Enter your first name'
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel='First name input'
                accessibilityHint='Enter your first name'
              />
            )}
          />

          <Controller
            control={control}
            name='lastName'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='Last Name'
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.lastName?.message}
                placeholder='Enter your last name'
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel='Last name input'
                accessibilityHint='Enter your last name'
              />
            )}
          />

          <Input
            label='Email'
            value={user?.email ?? ''}
            editable={false}
            placeholder='Email address'
            keyboardType='email-address'
            leftIcon='mail-outline'
            leftIconFamily='Ionicons'
            style={[styles.disabledInput, { backgroundColor: theme.colors.surfaceVariant }]}
            accessibilityLabel='Email address (read-only)'
            accessibilityHint='Your email address cannot be changed'
          />
          <Text variant='body' size='xs' color='secondary' style={styles.helperText}>
            Email cannot be changed. Contact support if you need to update your email.
          </Text>

          <Controller
            control={control}
            name='phoneNumber'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='Phone Number'
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phoneNumber?.message}
                placeholder='+21612345678'
                keyboardType='phone-pad'
                leftIcon='call-outline'
                leftIconFamily='Ionicons'
                accessibilityLabel='Phone number input'
                accessibilityHint='Enter your phone number in international format'
              />
            )}
          />
        </Card>

        {/* Address Section */}
        <Card style={styles.card}>
          <SectionHeader title='Address' icon='location-outline' />

          <Controller
            control={control}
            name='street'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='Street Address'
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.street?.message}
                placeholder='123 Main Street'
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel='Street address input'
                accessibilityHint='Enter your street address'
              />
            )}
          />

          <Controller
            control={control}
            name='city'
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label='City'
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.city?.message}
                placeholder='Tunis'
                autoCapitalize='words'
                returnKeyType='next'
                accessibilityLabel='City input'
                accessibilityHint='Enter your city'
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
                    label='Postal Code'
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.postalCode?.message}
                    placeholder='1000'
                    keyboardType='number-pad'
                    returnKeyType='next'
                    accessibilityLabel='Postal code input'
                    accessibilityHint='Enter your postal code'
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
                    label='Country'
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.country?.message}
                    placeholder='Tunisia'
                    autoCapitalize='words'
                    returnKeyType='done'
                    accessibilityLabel='Country input'
                    accessibilityHint='Enter your country'
                  />
                )}
              />
            </View>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            variant='primary'
            size='lg'
            onPress={handleSave}
            loading={isLoading || isImageUploading}
            disabled={isLoading || isImageUploading || (!isDirty && imageUri == null)}
            leftIcon='checkmark-circle-outline'
            leftIconFamily='Ionicons'
            style={styles.saveButton}
            accessibilityLabel='Save changes'
            accessibilityHint='Saves your profile changes and returns to profile screen'
          >
            {isImageUploading ? 'Uploading...' : 'Save Changes'}
          </Button>

          <Button
            variant='outline'
            size='md'
            onPress={handleCancel}
            disabled={isLoading || isImageUploading}
            leftIcon='close-circle-outline'
            leftIconFamily='Ionicons'
            accessibilityLabel='Cancel editing'
            accessibilityHint='Discards changes and returns to profile screen'
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    padding: 20,
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
    marginTop: 12,
  },
  changePhotoText: {
    marginLeft: 4,
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
    marginLeft: 8,
  },
  disabledInput: {
    opacity: 0.6,
  },
  helperText: {
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  buttonContainer: {
    marginTop: 8,
  },
  saveButton: {
    marginBottom: 12,
  },
  // eslint-disable-next-line react-native/no-color-literals
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.05)', // Light blue background for info box
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 18,
  },
});

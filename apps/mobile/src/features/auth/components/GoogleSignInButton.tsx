import React, { useState } from 'react';
import { Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Toast from 'react-native-toast-message';

import GoogleButtonSvg from '@/assets/images/android_light_rd_ctn.svg';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch } from '@/hooks/redux';
import { Logger } from '@/utils/logger';

import { googleSignInAsync } from '../store/authSlice';

export function GoogleSignInButton() {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        // signIn() resolved but returned no token (user cancelled or
        // One-Tap returned no credential). Show feedback so the user
        // knows something went wrong rather than seeing a frozen screen.
        Toast.show({
          type: 'error',
          text1: 'Google Sign-In failed',
          text2: 'Could not retrieve credentials. Please try again.',
        });
        return;
      }

      await dispatch(googleSignInAsync(idToken)).unwrap();

      Toast.show({
        type: 'success',
        text1: 'Welcome!',
        text2: 'You have signed in with Google.',
      });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };

      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User dismissed — silent
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // Already in progress — ignore
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Toast.show({
          type: 'error',
          text1: 'Google Play Services unavailable',
          text2: 'Please update Google Play Services and try again.',
        });
      } else {
        Logger.error('Google Sign-In error', {}, error as Error);
        Toast.show({
          type: 'error',
          text1: 'Google Sign-In failed',
          text2: err.message ?? 'Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      onPress={() => void handlePress()}
      disabled={isLoading}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole='button'
      accessibilityLabel='Continue with Google'
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='small' color={theme.colors.primary} />
        </View>
      ) : (
        <GoogleButtonSvg width='100%' height={52} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  loadingContainer: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
});

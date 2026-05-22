import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';
import Toast from 'react-native-toast-message';

import GoogleButtonSvg from '@/assets/images/android_light_rd_ctn.svg';
import { useAppDispatch } from '@/hooks/redux';
import { Logger } from '@/utils/logger';

import { googleSignInAsync } from '../store/authSlice';

export function GoogleSignInButton() {
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
        Toast.show({
          type: 'error',
          text1: 'Something went wrong',
          text2: 'Could not retrieve credentials. Please try again.',
        });
        return;
      }

      await dispatch(googleSignInAsync(idToken)).unwrap();

      Toast.show({
        type: 'success',
        text1: 'Welcome! \u{1F44B}',
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
        // Internal/config errors (DEVELOPER_ERROR, network, unknown) must never
        // surface raw SDK messages to the user — log to Sentry instead.
        Logger.error('Google Sign-In failed', { code: err.code }, error as Error);
        Sentry.captureException(error, { tags: { flow: 'google_signin', code: err.code } });
        Toast.show({
          type: 'error',
          text1: 'Sign-in failed',
          text2: 'Could not sign in with Google. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isLoading}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        isLoading && styles.buttonLoading,
      ]}
      accessibilityRole='button'
      accessibilityLabel='Continue with Google'
      accessibilityHint='Sign in with your Google account'
      accessibilityState={{ busy: isLoading }}
    >
      <GoogleButtonSvg width='100%' height={52} />
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
  buttonLoading: {
    opacity: 0.5,
  },
});

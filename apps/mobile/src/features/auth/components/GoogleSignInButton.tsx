import React, { useState } from 'react';
import { Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Toast from 'react-native-toast-message';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch } from '@/hooks/redux';
import { Logger } from '@/utils/logger';

import { googleSignInAsync } from '../store/authSlice';

export function GoogleSignInButton() {
  const { theme } = useTheme();
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
        throw new Error('missing_id_token');
      }

      await dispatch(googleSignInAsync(idToken)).unwrap();
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
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface },
        pressed && styles.buttonPressed,
      ]}
      accessibilityRole='button'
      accessibilityLabel='Continue with Google'
    >
      {isLoading ? (
        <ActivityIndicator size='small' color={theme.colors.primary} />
      ) : (
        <View style={styles.inner}>
          <View style={styles.gBadge}>
            <Text variant='body.medium' weight='bold' style={styles.gLetter}>
              G
            </Text>
          </View>
          <Text variant='body.medium' weight='semibold' color={theme.colors.onSurface}>
            Continue with Google
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gLetter: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 16,
  },
});

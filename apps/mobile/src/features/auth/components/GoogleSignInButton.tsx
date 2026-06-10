import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';

import GoogleButtonSvg from '@/assets/images/android_light_rd_ctn.svg';
import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useAppDispatch } from '@/hooks/redux';
import { Logger } from '@/utils/logger';
import { showSuccessToast } from '@/utils/toast';

import { googleSignInAsync } from '../store/authSlice';

interface GoogleSignInButtonProps {
  referralCode?: string | undefined;
}

export function GoogleSignInButton({ referralCode }: GoogleSignInButtonProps) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        setError('Could not retrieve credentials. Please try again.');
        return;
      }

      await dispatch(
        googleSignInAsync({ idToken, ...(referralCode ? { referralCode } : {}) }),
      ).unwrap();

      showSuccessToast('Welcome!');
    } catch (err: unknown) {
      try {
        await GoogleSignin.signOut();
      } catch {
        // signOut can fail if not signed in — safe to ignore
      }

      const typed = err as { code?: string; message?: string };

      if (typed.code === statusCodes.SIGN_IN_CANCELLED) {
        // User dismissed — silent, no error
      } else if (typed.code === statusCodes.IN_PROGRESS) {
        // Already in progress — ignore
      } else if (typed.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services unavailable. Please update and try again.');
      } else if (typed.code) {
        Logger.error('Google Sign-In failed', { code: typed.code }, err as Error);
        Sentry.captureException(
          err instanceof Error ? err : new Error(typed.message ?? 'Google Sign-In failed'),
          { tags: { flow: 'google_signin', code: typed.code } },
        );
        setError('Could not sign in with Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View>
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
      {error !== null && (
        <View
          style={[styles.errorRow, { backgroundColor: theme.colors.errorContainer ?? '#FEE2E2' }]}
        >
          <Icon
            name='alert-circle-outline'
            family='Ionicons'
            size={14}
            color={theme.colors.error}
          />
          <Text variant='body' size='xs' style={{ color: theme.colors.error, flex: 1 }}>
            {error}
          </Text>
        </View>
      )}
    </View>
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
});

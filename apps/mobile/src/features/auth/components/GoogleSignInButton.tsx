import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as Sentry from '@sentry/react-native';

import GoogleLogo from '@/assets/images/google_g_logo.svg';
import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { googleSignInButtonColors } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { typographyTokens } from '@/design-system/tokens/typography';
import { useAppDispatch } from '@/hooks/redux';
import { Logger } from '@/utils/logger';
import { showSuccessToast } from '@/utils/toast';

import { googleSignInAsync } from '../store/authSlice';

const { base: sp, radius, sizing } = spacingTokens;
const { fontFamily, fontSize, lineHeight } = typographyTokens;

/**
 * Google's branding guidelines put 10px between the "G" and the label. The
 * spacing scale has no 10, and this is Google's spec rather than ours
 * (DESIGN.md §19-E35), so it stays a named constant here instead of a token.
 */
const GOOGLE_LOGO_LABEL_GAP = 10;

/** Google's label is 14/20: the 14px base size at the snug (1.4) ratio. */
const LABEL_LINE_HEIGHT = Math.round(fontSize.base * lineHeight.snug);

interface GoogleSignInButtonProps {
  referralCode?: string | undefined;
}

export function GoogleSignInButton({ referralCode }: GoogleSignInButtonProps) {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const { t } = useTranslation();
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
        setError(t('auth.googleCredentialsFailed'));
        return;
      }

      await dispatch(
        googleSignInAsync({ idToken, ...(referralCode ? { referralCode } : {}) }),
      ).unwrap();

      showSuccessToast(t('auth.welcomeMessage'));
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
        setError(t('auth.googlePlayUnavailable'));
      } else if (typed.code) {
        Logger.error('Google Sign-In failed', { code: typed.code }, err as Error);
        Sentry.captureException(
          err instanceof Error ? err : new Error(typed.message ?? 'Google Sign-In failed'),
          { tags: { flow: 'google_signin', code: typed.code } },
        );
        setError(t('auth.googleSignInFailed'));
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
        accessibilityLabel={t('auth.continueWithGoogle')}
        accessibilityHint={t('auth.a11yGoogleSignInHint')}
        accessibilityState={{ busy: isLoading }}
      >
        <GoogleLogo width={sizing.icon.md} height={sizing.icon.md} />
        <Text
          variant='body.medium'
          weight='medium'
          size='base'
          lineHeight={LABEL_LINE_HEIGHT}
          align='center'
          color={googleSignInButtonColors.label}
          style={styles.label}
        >
          {t('auth.continueWithGoogle')}
        </Text>
      </Pressable>
      {error !== null && (
        <View
          style={[styles.errorRow, { backgroundColor: theme.colors.errorContainer ?? '#FEE2E2' }]}
        >
          <Icon
            name='alert-circle-outline'
            family='Ionicons'
            size={14}
            color={theme.colors.onErrorContainer}
          />
          <Text
            variant='body'
            size='xs'
            style={[styles.inlineErrorText, { color: theme.colors.onErrorContainer }]}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Google's light-theme Sign-In button (DESIGN.md §19-E35). The label is real,
 * translated text: Google's prebuilt artwork outlined "Continue with Google"
 * as a path, so it stayed English in fr and ar.
 */
const styles = StyleSheet.create({
  // Static half of the error row; the colour stays inline because it is
  // theme-dependent and cannot live in a static StyleSheet.
  inlineErrorText: { flex: 1 },
  button: {
    width: '100%',
    // minHeight, not height: a scaled system font grows the button rather
    // than clipping the label.
    minHeight: sizing.button.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GOOGLE_LOGO_LABEL_GAP,
    paddingHorizontal: sp[3],
    paddingVertical: sp.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: googleSignInButtonColors.border,
    backgroundColor: googleSignInButtonColors.surface,
  },
  label: {
    // Google specifies Google Sans, which is not licensed here; the platform
    // face is what its spec used before it (§19-E35).
    fontFamily: fontFamily.primary,
    // A flex-row child does not shrink by default, so a scaled font would clip
    // the label instead of wrapping it (textScalingSafety.test.tsx).
    flexShrink: 1,
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

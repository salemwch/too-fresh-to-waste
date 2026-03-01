/**
 * usePhoneVerification Hook
 * Handles phone verification requirement for order placement
 * Prompts users to add and verify their phone number when needed
 */

import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useAppSelector } from '@/hooks/redux';

import type { MainStackNavigationProp } from '@/navigation/types';

interface PhoneVerificationResult {
  isVerified: boolean;
  requiresPhoneSetup: boolean;
  requiresPhoneVerification: boolean;
}

interface UsePhoneVerificationReturn {
  checkPhoneVerification: () => PhoneVerificationResult;
  promptPhoneVerification: (onComplete?: () => void) => void;
}

/**
 * Hook to check and prompt phone verification for order placement
 *
 * @example
 * ```tsx
 * const { checkPhoneVerification, promptPhoneVerification } = usePhoneVerification();
 *
 * const handlePlaceOrder = () => {
 *   const verification = checkPhoneVerification();
 *
 *   if (!verification.isVerified) {
 *     promptPhoneVerification(() => {
 *       // Continue with order after verification
 *       createOrder();
 *     });
 *     return;
 *   }
 *
 *   // User is verified, proceed with order
 *   createOrder();
 * };
 * ```
 */
export const usePhoneVerification = (): UsePhoneVerificationReturn => {
  const navigation = useNavigation<MainStackNavigationProp>();
  const user = useAppSelector(state => state.auth.user);

  /**
   * Check if user has verified phone number
   * Returns detailed status about phone verification requirements
   */
  const checkPhoneVerification = useCallback((): PhoneVerificationResult => {
    if (!user) {
      return {
        isVerified: false,
        requiresPhoneSetup: true,
        requiresPhoneVerification: false,
      };
    }

    const hasPhone = !!user.phoneNumber;
    const isVerified = hasPhone && user.isPhoneVerified;

    return {
      isVerified,
      requiresPhoneSetup: !hasPhone,
      requiresPhoneVerification: hasPhone && !user.isPhoneVerified,
    };
  }, [user]);

  /**
   * Prompt user to verify their phone number
   * Shows appropriate alert based on whether they need to add phone or just verify
   *
   * @param onComplete - Optional callback to run after verification is complete
   */
  const promptPhoneVerification = useCallback(
    (onComplete?: () => void) => {
      const status = checkPhoneVerification();

      if (status.isVerified) {
        // Already verified, run callback immediately
        onComplete?.();
        return;
      }

      if (status.requiresPhoneSetup) {
        // User needs to add their phone number
        Alert.alert(
          'Phone Number Required',
          'To place orders, you need to add and verify your phone number. This helps us confirm your identity and notify you about your orders.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Add Phone Number',
              onPress: () => {
                // Navigate to VerifyPhone screen with flag to add phone first
                navigation.navigate('AuthStack', {
                  screen: 'VerifyPhone',
                  params: {
                    phoneNumber: undefined,
                    fromEmailVerification: false,
                    requiresPhoneSetup: true,
                    onVerificationComplete: onComplete,
                  },
                });
              },
            },
          ],
        );
      } else if (status.requiresPhoneVerification) {
        // User has phone but needs to verify it
        Alert.alert(
          'Phone Verification Required',
          "Your phone number needs to be verified before you can place orders. We'll send you a verification code via SMS.",
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Verify Now',
              onPress: () => {
                // Navigate to VerifyPhone screen
                navigation.navigate('AuthStack', {
                  screen: 'VerifyPhone',
                  params: {
                    phoneNumber: user?.phoneNumber,
                    fromEmailVerification: false,
                    requiresPhoneSetup: false,
                    onVerificationComplete: onComplete,
                  },
                });
              },
            },
          ],
        );
      }
    },
    [checkPhoneVerification, navigation, user],
  );

  return {
    checkPhoneVerification,
    promptPhoneVerification,
  };
};

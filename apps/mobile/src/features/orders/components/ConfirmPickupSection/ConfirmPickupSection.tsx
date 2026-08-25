/**
 * ConfirmPickupSection — the merchant-supplied pickup code.
 *
 * Three mutually exclusive states, in priority order:
 *   confirmed — already handed over, nothing left to do
 *   expired   — the pickup window closed; the code is dead and the input is gone
 *   default   — the code entry itself
 *
 * Expiry beats the input deliberately. `isOrderExpired` is time-based and flips
 * while the screen is open, so the field disappears the moment the window closes
 * rather than accepting a code the backend will reject.
 */

import React, { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import { cardStyles } from '../OrderDetailCards/cardStyles';
import { getPickupErrorKey } from '../../utils/orderStatus';

import type { InlinePickupError } from '../../utils/orderStatus';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

/** Pickup codes are always six digits — the input cap and the submit gate. */
const PICKUP_CODE_LENGTH = 6;

/** Fallbacks for when the theme has not resolved a palette entry. */
const FALLBACK_SUCCESS = colorTokens.base.success[500];
const FALLBACK_ERROR = colorTokens.base.error[500];
const FALLBACK_BORDER = '#d1d5db';
const FALLBACK_TEXT = '#000';
const PLACEHOLDER_COLOR = '#aaa';
const CODE_INPUT_BACKGROUND = '#fafafa';

const styles = StyleSheet.create({
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  successText: {
    color: FALLBACK_SUCCESS,
  },
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
    paddingVertical: 4,
  },
  expiredTextContainer: {
    flex: 1,
    gap: 2,
  },
  confirmHint: {
    marginBottom: sp[3],
  },
  codeInput: {
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    backgroundColor: CODE_INPUT_BACKGROUND,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  inlineErrorText: {
    flex: 1,
  },
  confirmButton: {
    marginTop: 16,
  },
});

export interface ConfirmPickupSectionProps {
  onConfirm: (code: string) => void;
  /** Clears a previous failure as soon as the user edits the code. */
  onClearError: () => void;
  isLoading: boolean;
  errorCode: InlinePickupError | null;
  isConfirmed: boolean;
  isExpired: boolean;
}

const ConfirmPickupSectionComponent: React.FC<ConfirmPickupSectionProps> = ({
  onConfirm,
  onClearError,
  isLoading,
  errorCode,
  isConfirmed,
  isExpired,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  const errorColor = theme.colors.base?.error?.[500] ?? FALLBACK_ERROR;

  const handleChangeText = useCallback(
    (text: string) => {
      setCode(text);
      // A stale error under a code the user is already rewriting is misleading.
      if (errorCode != null) onClearError();
    },
    [errorCode, onClearError],
  );

  const handleSubmit = useCallback(() => onConfirm(code), [onConfirm, code]);

  if (isConfirmed) {
    return (
      <Card style={cardStyles.card}>
        <View style={styles.successRow}>
          <Icon
            name='checkmark-circle'
            family='Ionicons'
            size={28}
            color={theme.colors.base?.success?.[500] ?? FALLBACK_SUCCESS}
          />
          <Text variant='body' size='md' weight='semibold' style={styles.successText}>
            {t('orders.pickupConfirmed')}
          </Text>
        </View>
      </Card>
    );
  }

  if (isExpired) {
    return (
      <Card style={cardStyles.card}>
        <View style={styles.expiredRow}>
          <Icon name='timer-outline' family='Ionicons' size={28} color={errorColor} />
          <View style={styles.expiredTextContainer}>
            <Text variant='body' size='md' weight='semibold' style={{ color: errorColor }}>
              {t('orders.orderExpired')}
            </Text>
            <Text variant='body' size='sm' color='secondary'>
              {t('orders.orderExpiredMessage')}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card style={cardStyles.card}>
      <Text
        variant='body'
        size='sm'
        weight='bold'
        color='secondary'
        style={cardStyles.sectionTitle}
      >
        {t('orders.confirmPickup')}
      </Text>
      <Text variant='body' size='sm' color='secondary' style={styles.confirmHint}>
        {t('orders.confirmPickupHint')}
      </Text>

      <TextInput
        style={[
          styles.codeInput,
          {
            borderColor:
              errorCode != null
                ? errorColor
                : (theme.colors.base?.neutral?.[300] ?? FALLBACK_BORDER),
          },
          { color: theme.colors.onBackground ?? FALLBACK_TEXT },
        ]}
        value={code}
        onChangeText={handleChangeText}
        keyboardType='numeric'
        maxLength={PICKUP_CODE_LENGTH}
        placeholder={t('orders.pickupCodePlaceholder')}
        placeholderTextColor={PLACEHOLDER_COLOR}
        autoFocus={false}
        editable={!isLoading}
        textAlign='center'
        accessibilityLabel={t('orders.a11yPickupCodeInput')}
        accessibilityHint={t('orders.a11yPickupCodeHint')}
      />

      {errorCode != null && (
        <View style={styles.inlineError}>
          <Icon name='alert-circle' family='Ionicons' size={16} color={errorColor} />
          <Text variant='body' size='sm' style={[styles.inlineErrorText, { color: errorColor }]}>
            {t(getPickupErrorKey(errorCode))}
          </Text>
        </View>
      )}

      <Button
        variant='primary'
        size='lg'
        disabled={code.length !== PICKUP_CODE_LENGTH || isLoading}
        loading={isLoading}
        onPress={handleSubmit}
        style={styles.confirmButton}
      >
        {t('orders.confirmPickupButton')}
      </Button>
    </Card>
  );
};

export const ConfirmPickupSection = memo(ConfirmPickupSectionComponent);
ConfirmPickupSection.displayName = 'ConfirmPickupSection';

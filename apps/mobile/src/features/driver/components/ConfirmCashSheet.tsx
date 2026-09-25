/**
 * ConfirmCashSheet - the driver confirms, at the door, what the customer paid.
 *
 * The amount is money in TFTW's ledger (`collectedCash`), so it is never
 * assumed: the field starts at the frozen `collectFromCustomer` figure for
 * speed, but the driver confirms it explicitly. Short is allowed and warned
 * (the backend flags it for review); over is blocked - the driver gives the
 * change back instead of TFTW recording money the customer did not owe.
 *
 * Online-paid orders collect nothing: the sheet says so and confirms 0.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Text } from '@/design-system/components/atoms';
import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { collectionStatus, parseCashAmount } from '../utils/deliveryCash';

import { DriverSheet } from './DriverSheet';

const { base: sp, radius } = spacingTokens;

export interface ConfirmCashSheetProps {
  visible: boolean;
  /** `driverInstruction.collectFromCustomer`, frozen at pickup. */
  expected: number;
  /** True when the customer paid online: nothing is collected. */
  paidOnline: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (collectedCash: number) => void;
}

const toField = (amount: number): string => amount.toFixed(3);

export const ConfirmCashSheet: React.FC<ConfirmCashSheetProps> = ({
  visible,
  expected,
  paidOnline,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const currency = t('common.currency');
  const [text, setText] = useState(toField(expected));

  // Reset to the expected figure each time the sheet opens.
  useEffect(() => {
    if (visible) setText(toField(expected));
  }, [visible, expected]);

  const parsed = parseCashAmount(text);
  const status = parsed === null ? null : collectionStatus(expected, parsed);

  const feedback = useMemo(() => {
    if (paidOnline) return null;
    if (parsed === null) return { kind: 'error' as const, text: t('driver.confirmCashInvalid') };
    if (status === 'over') {
      return {
        kind: 'error' as const,
        text: t('driver.confirmCashOver', { amount: toField(expected), currency }),
      };
    }
    if (status === 'short') {
      return {
        kind: 'warning' as const,
        text: t('driver.confirmCashShort', { amount: toField(expected - parsed), currency }),
      };
    }
    return null;
  }, [paidOnline, parsed, status, expected, currency, t]);

  const canConfirm = paidOnline || (parsed !== null && status !== 'over');

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(paidOnline ? 0 : (parsed as number));
  };

  return (
    <DriverSheet
      visible={visible}
      title={paidOnline ? t('driver.confirmOnlineTitle') : t('driver.confirmCashTitle')}
      {...(paidOnline
        ? {}
        : { subtitle: t('driver.confirmCashExpected', { amount: toField(expected), currency }) })}
      busy={isSubmitting}
      onClose={onClose}
      footer={
        <Button
          variant='success'
          size='lg'
          fullWidth
          onPress={handleConfirm}
          disabled={!canConfirm || isSubmitting}
          loading={isSubmitting}
          accessibilityHint={t('driver.a11yConfirmDeliveryHint')}
        >
          {t('driver.confirmDelivery')}
        </Button>
      }
    >
      {paidOnline ? (
        <View style={styles.notice}>
          <Text variant='body' size='md'>
            {t('driver.confirmOnlineBody')}
          </Text>
        </View>
      ) : (
        <>
          <Input
            label={t('driver.confirmCashLabel')}
            value={text}
            onChangeText={setText}
            keyboardType='decimal-pad'
            inputMode='decimal'
            selectTextOnFocus
            autoFocus
            accessibilityLabel={t('driver.confirmCashLabel')}
            accessibilityHint={t('driver.a11yCashFieldHint')}
            {...(feedback?.kind === 'error' ? { error: feedback.text } : {})}
          />
          {feedback?.kind === 'warning' ? (
            <View style={styles.warning} accessibilityLiveRegion='polite'>
              <Text variant='body' size='sm' style={styles.warningText}>
                {feedback.text}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </DriverSheet>
  );
};

ConfirmCashSheet.displayName = 'ConfirmCashSheet';

const useStyles = createThemedStyles((c: ThemePalette) =>
  StyleSheet.create({
    notice: {
      backgroundColor: c.infoContainer,
      borderRadius: radius.lg,
      padding: sp.md,
    },
    warning: {
      backgroundColor: c.warningContainer,
      borderRadius: radius.lg,
      padding: sp.sm,
    },
    warningText: {
      color: c.onWarningContainer,
    },
  }),
);

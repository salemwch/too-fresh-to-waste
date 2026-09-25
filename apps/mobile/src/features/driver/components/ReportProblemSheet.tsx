/**
 * ReportProblemSheet - the delivery cannot be completed after the food was
 * collected (and the merchant paid from the float).
 *
 * Both answers are required by the money model (`deliveryFailure`): why, and
 * what happened to the food. A merchant-fault failure has one allowed
 * outcome - the food goes back and the store returns the money - so the other
 * outcomes are hidden for it rather than rejected after submit. The default
 * outcome is "not decided yet", which books no loss until an admin decides.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, Input, Text } from '@/design-system/components/atoms';
import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';
import { useTheme } from '@/design-system/providers';
import { spacingTokens } from '@/design-system/tokens/spacing';

import {
  allowedRecoveries,
  defaultRecovery,
  FAILURE_REASONS,
  type DeliveryFailureReason,
  type DeliveryRecovery,
} from '../utils/deliveryCash';

import { DriverSheet } from './DriverSheet';

const { base: sp, radius, touchTarget } = spacingTokens;

export interface ReportProblemSheetProps {
  visible: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: {
    reason: DeliveryFailureReason;
    recovery: DeliveryRecovery;
    notes?: string;
  }) => void;
}

interface ChoiceProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const Choice: React.FC<ChoiceProps> = ({ label, selected, onPress }) => {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hint = t('driver.a11yChoiceHint');

  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
      accessibilityRole='radio'
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      {/* The app's radio pattern (VoteBottomSheet): a check when chosen, a ring
          when not - both glyph-free or already in the shipped icon subset. */}
      {selected ? (
        <Icon name='checkmark-circle' family='Ionicons' size={22} color={colors.primary} />
      ) : (
        <View style={styles.radioRing} />
      )}
      <Text variant='body' size='md' style={styles.choiceText}>
        {label}
      </Text>
    </Pressable>
  );
};

export const ReportProblemSheet: React.FC<ReportProblemSheetProps> = ({
  visible,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const [reason, setReason] = useState<DeliveryFailureReason | null>(null);
  const [recovery, setRecovery] = useState<DeliveryRecovery>('RECOVERABLE_PENDING');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(null);
      setRecovery('RECOVERABLE_PENDING');
      setNotes('');
    }
  }, [visible]);

  const chooseReason = (next: DeliveryFailureReason) => {
    setReason(next);
    // Keep a still-allowed choice; otherwise fall back to the safe default.
    setRecovery(current =>
      allowedRecoveries(next).includes(current) ? current : defaultRecovery(next),
    );
  };

  const submit = () => {
    if (!reason) return;
    const trimmed = notes.trim();
    onSubmit({ reason, recovery, ...(trimmed ? { notes: trimmed } : {}) });
  };

  return (
    <DriverSheet
      visible={visible}
      title={t('driver.reportProblemTitle')}
      subtitle={t('driver.reportProblemSubtitle')}
      busy={isSubmitting}
      onClose={onClose}
      footer={
        <Button
          variant='danger'
          size='lg'
          fullWidth
          onPress={submit}
          disabled={!reason || isSubmitting}
          loading={isSubmitting}
        >
          {t('driver.sendReport')}
        </Button>
      }
    >
      <View accessibilityRole='radiogroup' style={styles.group}>
        {FAILURE_REASONS.map(r => (
          <Choice
            key={r}
            label={t(`driver.reason${r}`)}
            selected={reason === r}
            onPress={() => chooseReason(r)}
          />
        ))}
      </View>

      {reason ? (
        <>
          <Text variant='title' size='md' weight='semibold' accessibilityRole='header'>
            {t('driver.foodOutcomeTitle')}
          </Text>
          <View accessibilityRole='radiogroup' style={styles.group}>
            {allowedRecoveries(reason).map(r => (
              <Choice
                key={r}
                label={t(`driver.recovery${r}`)}
                selected={recovery === r}
                onPress={() => setRecovery(r)}
              />
            ))}
          </View>
          <Input
            label={t('driver.problemNotesLabel')}
            value={notes}
            onChangeText={setNotes}
            maxLength={500}
            multiline
          />
        </>
      ) : null}
    </DriverSheet>
  );
};

ReportProblemSheet.displayName = 'ReportProblemSheet';

const useStyles = createThemedStyles((c: ThemePalette) =>
  StyleSheet.create({
    group: {
      gap: sp.xs,
    },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sp.sm,
      minHeight: touchTarget.minimum,
      paddingHorizontal: sp.sm,
      paddingVertical: sp.xs,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.outlineVariant,
      backgroundColor: c.surface,
    },
    choiceSelected: {
      borderColor: c.primary,
      backgroundColor: c.primaryContainer,
    },
    radioRing: {
      width: 22,
      height: 22,
      borderRadius: radius.full,
      borderWidth: 2,
      borderColor: c.outline,
    },
    choiceText: {
      flex: 1,
      color: c.onSurface,
    },
  }),
);

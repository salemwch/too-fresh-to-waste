/**
 * DriverSheet - the bottom-sheet shell shared by the driver's money sheets.
 *
 * DESIGN.md §13.5: on mobile a modal becomes a bottom sheet (thumb zone, no
 * overflow at 360px), radius `xl` on the top corners, black/50 overlay, never
 * nested. `accessibilityViewIsModal` keeps screen readers inside the sheet
 * while it is open; the backdrop and the close button both dismiss it, except
 * while a request is in flight - closing then would hide whether the money was
 * recorded.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';
import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp, radius, touchTarget } = spacingTokens;
const SHADOW = colorTokens.base.neutral[1000];

export interface DriverSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** While true the sheet cannot be dismissed. */
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export const DriverSheet: React.FC<DriverSheetProps> = ({
  visible,
  title,
  subtitle,
  busy = false,
  onClose,
  children,
  footer,
}) => {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const requestClose = () => {
    if (!busy) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop: a sibling, not a parent, so taps inside the sheet never reach it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
          accessibilityRole='button'
          accessibilityLabel={t('driver.a11yCloseSheet')}
          accessibilityHint={t('driver.a11yCloseSheetHint')}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant='title' size='lg' weight='bold' accessibilityRole='header'>
                {title}
              </Text>
              {subtitle ? (
                <Text variant='body' size='sm' color='secondary'>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={requestClose}
              disabled={busy}
              style={styles.closeButton}
              accessibilityRole='button'
              accessibilityLabel={t('driver.a11yCloseSheet')}
              accessibilityHint={t('driver.a11yCloseSheetHint')}
              accessibilityState={{ disabled: busy }}
            >
              <Icon name='close' family='Ionicons' size={24} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps='handled'
            bounces={false}
          >
            {children}
          </ScrollView>

          <View style={styles.footer}>{footer}</View>
        </View>
      </View>
    </Modal>
  );
};

DriverSheet.displayName = 'DriverSheet';

const useStyles = createThemedStyles((c: ThemePalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: c.overlay.dark,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: sp.md,
      paddingTop: sp.md,
      paddingBottom: sp.lg,
      maxHeight: '90%',
      ...Platform.select({
        ios: {
          shadowColor: SHADOW,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: { elevation: 8 },
      }),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: sp.sm,
      marginBottom: sp.md,
    },
    headerText: {
      flex: 1,
      gap: sp.xxs,
    },
    closeButton: {
      width: touchTarget.minimum,
      height: touchTarget.minimum,
      alignItems: 'center',
      justifyContent: 'center',
      // Pulls the 44px target back so the glyph lines up with the text edge.
      marginEnd: -sp.sm,
      marginTop: -sp.sm,
    },
    body: {
      flexGrow: 0,
    },
    bodyContent: {
      gap: sp.md,
      paddingBottom: sp.md,
    },
    footer: {
      gap: sp.sm,
    },
  }),
);

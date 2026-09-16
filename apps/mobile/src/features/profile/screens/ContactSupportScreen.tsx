import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, Linking, Pressable } from 'react-native';

import { Text, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { showAlert } from '@/utils/alert';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { useFloatingTabBarContentInset } from '@/navigation/hooks/useFloatingTabBarInset';

const { base: sp } = spacingTokens;

const SUPPORT_EMAIL = 'support@toofreshtowaste.com';

export const ContactSupportScreen: React.FC = () => {
  // Content runs under the absolutely-positioned tab bar, so the list has to
  // pad itself or its last row can never be scrolled clear of the shape.
  const tabBarInset = useFloatingTabBarContentInset(styles.scrollContent);
  const { t } = useTranslation();
  const theme = useTheme();

  const handleEmailPress = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      showAlert(
        t('profile.supportScreen.cannotOpenTitle'),
        t('profile.supportScreen.cannotOpenMessage', { email: SUPPORT_EMAIL }),
        [{ text: t('common.ok') }],
        { type: 'info' },
      );
    });
  }, [t]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={tabBarInset} showsVerticalScrollIndicator={false}>
        {/* Header illustration */}
        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon name='headset' family='Ionicons' size={40} color={theme.colors.primary} />
        </View>

        <Text variant='headline' size='lg' weight='bold' align='center' style={styles.title}>
          {t('profile.supportScreen.title')}
        </Text>
        <Text variant='body' size='sm' color='secondary' align='center' style={styles.subtitle}>
          {t('profile.supportScreen.subtitle')}
        </Text>

        {/* Email card */}
        <Card style={[styles.card, { borderColor: theme.colors.outlineVariant }]}>
          <View style={styles.cardRow}>
            <View
              style={[styles.cardIconWrapper, { backgroundColor: theme.colors.primaryContainer }]}
            >
              <Icon name='mail-outline' family='Ionicons' size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.cardText}>
              <Text variant='label' size='xs' color='secondary' style={styles.cardLabel}>
                {t('profile.supportScreen.emailLabel')}
              </Text>
              <Text variant='body' size='md' weight='semibold' color='primary'>
                {SUPPORT_EMAIL}
              </Text>
              <Text variant='body' size='xs' color='secondary' style={styles.responseTime}>
                {t('profile.supportScreen.responseTime')}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.emailButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleEmailPress}
            accessibilityRole='button'
            accessibilityLabel={t('errors.a11ySendSupportEmail')}
            accessibilityHint={t('profile.supportScreen.a11ySendEmailHint', {
              email: SUPPORT_EMAIL,
            })}
          >
            <Icon name='send-outline' family='Ionicons' size={16} color={theme.colors.onPrimary} />
            <Text
              variant='label'
              size='sm'
              weight='semibold'
              style={[styles.emailButtonText, { color: theme.colors.onPrimary }]}
            >
              {t('profile.supportScreen.sendEmail')}
            </Text>
          </Pressable>
        </Card>

        {/* Info note */}
        <View style={[styles.note, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon
            name='information-circle-outline'
            family='Ionicons'
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant='body'
            size='xs'
            style={[styles.noteText, { color: theme.colors.onSurfaceVariant }]}
          >
            {t('profile.supportScreen.note')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, alignItems: 'center' },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp[5],
    marginTop: 8,
  },
  title: { marginBottom: 8 },
  subtitle: { marginBottom: 32, maxWidth: 300 },
  card: {
    width: '100%',
    padding: sp[5],
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: sp[5], gap: 14 },
  cardIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardText: { flex: 1 },
  cardLabel: { marginBottom: 4, letterSpacing: 0.5 },
  responseTime: { marginTop: 4 },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emailButtonText: { letterSpacing: 0.2 },
  note: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: 10,
  },
  noteText: { flex: 1, lineHeight: 18 },
});

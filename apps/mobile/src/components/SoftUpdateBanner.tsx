import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/design-system/providers';
import { Text, Icon } from '@/design-system/components/atoms';

interface SoftUpdateBannerProps {
  visible: boolean;
  updateUrl: string;
  onDismiss: () => void;
}

export const SoftUpdateBanner = memo<SoftUpdateBannerProps>(({ visible, updateUrl, onDismiss }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const handleUpdate = useCallback(() => {
    Linking.openURL(updateUrl);
  }, [updateUrl]);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primaryContainer,
          paddingTop: insets.top + 4,
        },
      ]}
    >
      <View style={styles.content}>
        <Icon name='arrow-up-circle' family='Ionicons' size='sm' color={theme.colors.primary} />
        <Text variant='body.small' weight='medium' style={styles.text} numberOfLines={1}>
          {t('update.softMessage')}
        </Text>
        <Pressable onPress={handleUpdate} hitSlop={8}>
          <Text variant='label.medium' weight='semibold' color='primary'>
            {t('update.softButton')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel='Dismiss update banner'
        >
          <Icon name='close' family='Ionicons' size='sm' color={theme.colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </View>
  );
});

SoftUpdateBanner.displayName = 'SoftUpdateBanner';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  text: {
    flex: 1,
  },
});

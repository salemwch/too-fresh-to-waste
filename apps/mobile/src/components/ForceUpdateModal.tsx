import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Modal, Linking } from 'react-native';

import { useTheme } from '@/design-system/providers';
import { Button, Text, Icon } from '@/design-system/components/atoms';

interface ForceUpdateModalProps {
  visible: boolean;
  updateUrl: string;
  latestVersion: string;
}

export const ForceUpdateModal = memo<ForceUpdateModalProps>(
  ({ visible, updateUrl, latestVersion }) => {
    const theme = useTheme();
    const { t } = useTranslation();

    const handleUpdate = useCallback(() => {
      Linking.openURL(updateUrl);
    }, [updateUrl]);

    return (
      <Modal visible={visible} transparent animationType='fade' statusBarTranslucent>
        <View style={[styles.overlay, { backgroundColor: theme.colors.overlay.dark }]}>
          <View
            style={[
              styles.container,
              {
                backgroundColor: theme.colors.surface,
                shadowColor: theme.colors.onSurface,
              },
            ]}
          >
            <View
              style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}
            >
              <Icon
                name='arrow-up-circle-outline'
                family='Ionicons'
                size='xl'
                color={theme.colors.primary}
              />
            </View>

            <Text variant='headline.medium' weight='semibold' align='center' style={styles.title}>
              {t('update.forceTitle')}
            </Text>

            <Text variant='body.medium' color='secondary' align='center' style={styles.description}>
              {t('update.forceDescription', { version: latestVersion })}
            </Text>

            <Button variant='primary' size='lg' onPress={handleUpdate} style={styles.button}>
              {t('update.forceButton')}
            </Button>
          </View>
        </View>
      </Modal>
    );
  },
);

ForceUpdateModal.displayName = 'ForceUpdateModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 32,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    marginBottom: 12,
  },
  description: {
    marginBottom: 28,
    lineHeight: 22,
  },
  button: {
    width: '100%',
  },
});

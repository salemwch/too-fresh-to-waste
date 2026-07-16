import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import { Text, Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { Logger } from '@/utils/logger';

const DEEP_LINK_SCHEME = 'toofreshtowaste://';

interface KonnectPaymentSheetProps {
  visible: boolean;
  payUrl: string;
  onDismiss: () => void;
  onPaymentFailed: () => void;
}

export const KonnectPaymentSheet: React.FC<KonnectPaymentSheetProps> = ({
  visible,
  payUrl,
  onDismiss,
  onPaymentFailed,
}) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const handleShouldStartLoad = useCallback(
    (event: { url: string }): boolean => {
      if (event.url.startsWith(DEEP_LINK_SCHEME)) {
        if (event.url.includes('order-payment-success')) {
          Logger.debug('[KonnectPaymentSheet] Payment success redirect detected');
          onDismiss();
        } else if (event.url.includes('order-payment-failed')) {
          Logger.debug('[KonnectPaymentSheet] Payment failure redirect detected');
          onPaymentFailed();
        }
        return false;
      }
      return true;
    },
    [onDismiss, onPaymentFailed],
  );

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    Logger.error('[KonnectPaymentSheet] WebView failed to load payment page');
    setIsLoading(false);
    setLoadError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setLoadError(false);
    setIsLoading(true);
  }, []);

  if (!visible || !payUrl) return null;

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='fullScreen'
      onRequestClose={onPaymentFailed}
    >
      <StatusBar barStyle='dark-content' />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeButton}
            onPress={onPaymentFailed}
            accessibilityLabel='Close payment'
            accessibilityRole='button'
            hitSlop={12}
          >
            <Icon name='close' family='Ionicons' size={24} color={TEXT_PRIMARY} />
          </Pressable>
          <Text style={styles.headerTitle}>Payment</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* WebView or Error */}
        {loadError ? (
          <View style={styles.errorContainer}>
            <Icon name='cloud-offline' family='Ionicons' size={48} color={TEXT_SECONDARY} />
            <Text style={styles.errorTitle}>Unable to load payment page</Text>
            <Text style={styles.errorSubtitle}>Check your connection and try again</Text>
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            key={loadError ? 'retry' : 'initial'}
            source={{ uri: payUrl }}
            style={styles.webview}
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['https://*', 'http://*', 'toofreshtowaste://*']}
          />
        )}

        {/* Loading overlay */}
        {isLoading && !loadError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size='large' color={BRAND_PRIMARY} />
            <Text style={styles.loadingText}>Loading payment...</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const BRAND_PRIMARY = colorTokens.base.primary[500];
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#64748B';
const SURFACE = '#FFFFFF';
const BORDER_SUBTLE = '#E2E8F0';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SUBTLE,
    backgroundColor: SURFACE,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  headerSpacer: {
    width: 36,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: BRAND_PRIMARY,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

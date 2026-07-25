/**
 * Toast Notification Utility
 * Production-ready toast notifications with custom styling
 */

import Icon from '@react-native-vector-icons/ionicons';
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Toast from 'react-native-toast-message';

import i18n from '@/i18n';

import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';

type ToastRenderProps = ToastConfigParams<unknown>;

const TOAST_COLORS = {
  surface: '#FFFFFF',
  shadow: '#000000',
  success: '#10B981',
  error: '#EF4444',
  info: '#3B82F6',
  warning: '#F59E0B',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
} as const;

/**
 * Custom toast configuration with design system styling
 * ✅ Wrapped in Pressable to support onPress
 */
export const toastConfig: ToastConfig = {
  success: (props: ToastRenderProps) => (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={i18n.t('common.a11ySuccessToast')}
      accessibilityHint={i18n.t('common.a11yDismissToast')}
      onPress={props.onPress}
      style={[styles.containerBase, styles.successContainer]}
    >
      <View style={styles.iconContainer}>
        <Icon name='checkmark-circle' size={24} color={TOAST_COLORS.success} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
  error: (props: ToastRenderProps) => (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={i18n.t('common.a11yErrorToast')}
      accessibilityHint={i18n.t('common.a11yDismissToast')}
      onPress={props.onPress}
      style={[styles.containerBase, styles.errorContainer]}
    >
      <View style={styles.iconContainer}>
        <Icon name='close-circle' size={24} color={TOAST_COLORS.error} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
  info: (props: ToastRenderProps) => (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={i18n.t('common.a11yInfoToast')}
      accessibilityHint={i18n.t('common.a11yDismissToast')}
      onPress={props.onPress}
      style={[styles.containerBase, styles.infoContainer]}
    >
      <View style={styles.iconContainer}>
        <Icon name='information-circle' size={24} color={TOAST_COLORS.info} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
  warning: (props: ToastRenderProps) => (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={i18n.t('common.a11yWarningToast')}
      accessibilityHint={i18n.t('common.a11yDismissToast')}
      onPress={props.onPress}
      style={[styles.containerBase, styles.warningContainer]}
    >
      <View style={styles.iconContainer}>
        <Icon name='warning' size={24} color={TOAST_COLORS.warning} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
};

const styles = StyleSheet.create({
  containerBase: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOAST_COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: TOAST_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 280,
    maxWidth: 340,
  },
  successContainer: {
    borderLeftColor: TOAST_COLORS.success,
  },
  errorContainer: {
    borderLeftColor: TOAST_COLORS.error,
  },
  infoContainer: {
    borderLeftColor: TOAST_COLORS.info,
  },
  warningContainer: {
    borderLeftColor: TOAST_COLORS.warning,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  text1: {
    fontSize: 14,
    fontWeight: '600',
    color: TOAST_COLORS.textPrimary,
    marginBottom: 2,
  },
  text2: {
    fontSize: 12,
    fontWeight: '400',
    color: TOAST_COLORS.textSecondary,
    lineHeight: 16,
  },
});

/**
 * Show success toast notification
 *
 * @param message - Success message to display
 * @param description - Optional secondary text
 * @param duration - Optional duration in ms (default: 3000ms)
 *
 * @example
 * showSuccessToast('Welcome back, John! 🎉');
 * showSuccessToast('Profile updated', 'Your changes have been saved', 2000);
 */
export const showSuccessToast = (
  message: string,
  description?: string,
  duration: number = 3000,
) => {
  Toast.show({
    type: 'success',
    text1: message,
    ...(description && { text2: description }),
    position: 'top',
    visibilityTime: duration,
    topOffset: 60,
  });
};

/**
 * Show error toast notification
 */
export const showErrorToast = (message: string, description?: string) => {
  Toast.show({
    type: 'error',
    text1: message,
    ...(description && { text2: description }),
    position: 'top',
    visibilityTime: 4000,
    topOffset: 60,
  });
};

/**
 * Show info toast notification
 */
export const showInfoToast = (message: string, description?: string) => {
  Toast.show({
    type: 'info',
    text1: message,
    ...(description && { text2: description }),
    position: 'top',
    visibilityTime: 3000,
    topOffset: 60,
  });
};

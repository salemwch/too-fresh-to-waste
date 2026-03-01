/**
 * Toast Notification Utility
 * Production-ready toast notifications with custom styling
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from '@react-native-vector-icons/ionicons';

import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';

/**
 * Custom toast configuration with design system styling
 * ✅ Wrapped in Pressable to support onPress
 */
export const toastConfig: ToastConfig = {
  success: (props: ToastConfigParams<any>) => (
    <Pressable
      onPress={props.onPress}
      style={styles.successContainer}
    >
      <View style={styles.iconContainer}>
        <Icon name='checkmark-circle' size={24} color='#10B981' />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
  error: (props: ToastConfigParams<any>) => (
    <Pressable
      onPress={props.onPress}
      style={styles.errorContainer}
    >
      <View style={styles.iconContainer}>
        <Icon name='close-circle' size={24} color='#EF4444' />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
  info: (props: ToastConfigParams<any>) => (
    <Pressable
      onPress={props.onPress}
      style={styles.infoContainer}
    >
      <View style={styles.iconContainer}>
        <Icon name='information-circle' size={24} color='#3B82F6' />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
  warning: (props: ToastConfigParams<any>) => (
    <Pressable
      onPress={props.onPress}
      style={styles.warningContainer}
    >
      <View style={styles.iconContainer}>
        <Icon name='warning' size={24} color='#F59E0B' />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text1}>{props.text1}</Text>
        {props.text2 && <Text style={styles.text2}>{props.text2}</Text>}
      </View>
    </Pressable>
  ),
};

const styles = StyleSheet.create({
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 280,
    maxWidth: 340,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 280,
    maxWidth: 340,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 280,
    maxWidth: 340,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 280,
    maxWidth: 340,
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
    color: '#1F2937',
    marginBottom: 2,
  },
  text2: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
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
export const showSuccessToast = (message: string, description?: string, duration: number = 3000) => {
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

/**
 * Show warning toast notification
 */
export const showWarningToast = (message: string, description?: string) => {
  Toast.show({
    type: 'warning',
    text1: message,
    ...(description && { text2: description }),
    position: 'top',
    visibilityTime: 4000,
    topOffset: 60,
  });
};

/**
 * Hide all toast notifications
 */
export const hideToast = () => {
  Toast.hide();
};

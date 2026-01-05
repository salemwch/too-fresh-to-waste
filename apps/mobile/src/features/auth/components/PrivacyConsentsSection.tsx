/**
 * Privacy Consents Section Component
 *
 * Tunisia Law No. 2004-63 Compliance
 * Collects required privacy consents during registration
 *
 * Required Consents (Tunisia Law):
 * - Data Processing Consent
 * - Location Tracking Consent
 * - Communication Consent
 *
 * Optional Consents:
 * - Marketing/Newsletter Consent
 *
 * Features:
 * - Clear, user-friendly language
 * - Links to Privacy Policy (opens in browser)
 * - Visual distinction between required and optional
 * - Accessible labels for screen readers
 * - Expandable section to reduce form clutter
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

export interface PrivacyConsents {
  dataProcessingConsent: boolean;
  locationTrackingConsent: boolean;
  communicationConsent: boolean;
  marketingConsent: boolean;
}

interface PrivacyConsentsSectionProps {
  consents: PrivacyConsents;
  onChange: (consents: PrivacyConsents) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

export const PrivacyConsentsSection: React.FC<PrivacyConsentsSectionProps> = ({
  consents,
  onChange,
  errors = {},
  disabled = false,
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Handle individual consent toggle
   */
  const handleToggleConsent = (key: keyof PrivacyConsents) => {
    onChange({
      ...consents,
      [key]: !consents[key],
    });
  };

  /**
   * Open Privacy Policy in browser
   */
  const handleOpenPrivacyPolicy = async () => {
    const privacyPolicyUrl = 'https://yourapp.com/privacy-policy'; // TODO: Replace with actual URL
    const canOpen = await Linking.canOpenURL(privacyPolicyUrl);
    if (canOpen) {
      await Linking.openURL(privacyPolicyUrl);
    }
  };

  /**
   * Render individual consent checkbox
   */
  const renderConsent = (
    key: keyof PrivacyConsents,
    label: string,
    description: string,
    required: boolean = true,
  ) => {
    const isChecked = consents[key];
    const hasError = errors[key];

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.consentRow,
          hasError && {
            borderColor: theme.colors.error,
            borderWidth: 1,
            borderRadius: 8,
            padding: 8,
          },
        ]}
        onPress={() => handleToggleConsent(key)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole='checkbox'
        accessibilityState={{ checked: isChecked }}
        accessibilityLabel={`${label}. ${description}. ${required ? 'Required' : 'Optional'}`}
      >
        <View
          style={[
            styles.checkbox,
            hasError && { borderColor: theme.colors.error },
            isChecked && {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            },
            !isChecked && styles.checkboxUnchecked,
          ]}
        >
          {isChecked && (
            <Text style={[styles.checkboxText, { color: theme.colors.onPrimary }]}>✓</Text>
          )}
        </View>
        <View style={styles.consentTextContainer}>
          <View style={styles.consentLabelRow}>
            <Text variant='body.small' weight='medium'>
              {label}
            </Text>
            {required && (
              <View
                style={[styles.requiredBadge, { backgroundColor: theme.colors.errorContainer }]}
              >
                <Text
                  variant='label.small'
                  weight='bold'
                  style={{ color: theme.colors.onErrorContainer, lineHeight: 10 }}
                >
                  REQUIRED
                </Text>
              </View>
            )}
          </View>
          <Text variant='label.small' color='secondary' style={styles.consentDescription}>
            {description}
          </Text>
          {hasError && (
            <Text variant='label.small' style={[styles.errorText, { color: theme.colors.error }]}>
              {hasError}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View>
          <Text variant='body.medium' weight='semibold'>
            Privacy Preferences
          </Text>
          <Text variant='label.small' color='secondary' style={{ lineHeight: 10 }}>
            Tunisia Law No. 2004-63 compliance
          </Text>
        </View>
        <Text variant='body.large' weight='medium' style={{ color: theme.colors.primary }}>
          {isExpanded ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.consentsList}>
          {/* Privacy Policy Link */}
          <TouchableOpacity
            style={styles.privacyPolicyLink}
            onPress={handleOpenPrivacyPolicy}
            activeOpacity={0.7}
          >
            <Text variant='label.small' color='primary' weight='medium' style={{ lineHeight: 10 }}>
              📄 Read our Privacy Policy
            </Text>
          </TouchableOpacity>

          {/* Required Consents */}
          <Text
            variant='label.small'
            weight='bold'
            style={[styles.sectionTitle, { lineHeight: 10 }]}
          >
            Required Consents (Tunisia Law)
          </Text>

          {renderConsent(
            'dataProcessingConsent',
            'Data Processing',
            'I consent to the processing of my personal data to use this application',
            true,
          )}

          {renderConsent(
            'locationTrackingConsent',
            'Location Tracking',
            'I consent to location tracking to find nearby food offers and improve my experience',
            true,
          )}

          {renderConsent(
            'communicationConsent',
            'Communications',
            'I consent to receive essential communications about my orders and account',
            true,
          )}

          {/* Optional Consents */}
          <Text
            variant='label.small'
            weight='bold'
            style={[styles.sectionTitle, { marginTop: 16 }]}
          >
            Optional Preferences
          </Text>

          {renderConsent(
            'marketingConsent',
            'Marketing & Newsletter',
            'I consent to receive promotional emails, offers, and newsletters (you can opt out anytime)',
            false,
          )}

          {/* Legal Notice */}
          <View style={[styles.legalNotice, { backgroundColor: theme.colors.surfaceContainer }]}>
            <Text variant='label.small' color='secondary' style={styles.legalNoticeText}>
              🇹🇳 Your privacy rights are protected under Tunisia Law No. 2004-63 on Personal Data
              Protection. You can withdraw your consent or request data deletion at any time from
              your account settings.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  consentsList: {
    marginTop: 12,
    gap: 12,
  },
  privacyPolicyLink: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxUnchecked: {
    backgroundColor: 'transparent',
  },
  checkboxText: {
    fontSize: 14,
  },
  consentTextContainer: {
    flex: 1,
  },
  consentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  requiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  consentDescription: {
    lineHeight: 18,
  },
  errorText: {
    marginTop: 4,
  },
  legalNotice: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  legalNoticeText: {
    lineHeight: 18,
  },
});

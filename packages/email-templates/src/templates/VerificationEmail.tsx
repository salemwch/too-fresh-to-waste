import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailBase, styles } from '../components/EmailBase';

export interface VerificationEmailProps {
  firstName: string;
  verificationUrl: string;
}

export function VerificationEmail({ firstName, verificationUrl }: VerificationEmailProps) {
  return (
    <EmailBase preview={`Verify your Too Fresh To Waste account, ${firstName}`}>
      <Section style={styles.content}>
        <Text style={styles.greeting}>Hi {firstName}! 👋</Text>

        <Text style={styles.paragraph}>
          Welcome to Too Fresh To Waste! You&apos;re one step away from joining our mission to
          reduce food waste. Please verify your email address to activate your account.
        </Text>

        <Section style={styles.buttonContainer}>
          <Button href={verificationUrl} style={styles.button}>
            ✅ Verify Email Address
          </Button>
        </Section>

        <Section style={styles.notice}>
          <Text style={styles.noticeText}>
            ⏰ <strong>Important:</strong> This verification link will expire in{' '}
            <strong>24 hours</strong> for security reasons.
          </Text>
        </Section>

        <Text style={styles.paragraph}>
          If you didn&apos;t create an account with us, you can safely ignore this email.
        </Text>

        <Text style={styles.fallbackLabel}>
          <strong>Trouble clicking the button?</strong> Copy and paste this link into your browser:
        </Text>
        <Text style={styles.fallbackUrl}>{verificationUrl}</Text>
      </Section>
    </EmailBase>
  );
}

export default VerificationEmail;

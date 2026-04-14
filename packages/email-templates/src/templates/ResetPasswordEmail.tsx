import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailBase, styles } from '../components/EmailBase';

export interface ResetPasswordEmailProps {
  firstName: string;
  resetUrl: string;
}

export function ResetPasswordEmail({ firstName, resetUrl }: ResetPasswordEmailProps) {
  return (
    <EmailBase preview={`Reset your Too Fresh To Waste password, ${firstName}`}>
      <Section style={styles.content}>
        <Text style={styles.greeting}>Hello {firstName},</Text>

        <Text style={styles.paragraph}>
          We received a request to reset the password for your Too Fresh To Waste account. Click the
          button below to create a new password.
        </Text>

        <Section style={styles.buttonContainer}>
          <Button href={resetUrl} style={styles.button}>
            🔑 Reset Password
          </Button>
        </Section>

        <Section style={styles.notice}>
          <Text style={styles.noticeText}>
            ⏰ <strong>Security Notice:</strong> This link will expire in <strong>1 hour</strong>.
            If you didn&apos;t request a password reset, you can safely ignore this email — your
            password will remain unchanged.
          </Text>
        </Section>

        <Text style={styles.fallbackLabel}>
          <strong>Trouble clicking the button?</strong> Copy and paste this link into your browser:
        </Text>
        <Text style={styles.fallbackUrl}>{resetUrl}</Text>
      </Section>
    </EmailBase>
  );
}

export default ResetPasswordEmail;

import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailBase, styles } from '../components/EmailBase';

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
};

export interface OAuthSignInEmailProps {
  firstName: string;
  provider: string;
  loginUrl: string;
}

export function OAuthSignInEmail({ firstName, provider, loginUrl }: OAuthSignInEmailProps) {
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;

  return (
    <EmailBase preview={`Sign in to Too Fresh To Waste with ${providerLabel}`}>
      <Section style={styles.content}>
        <Text style={styles.greeting}>Hi {firstName},</Text>

        <Text style={styles.paragraph}>
          We received a password reset request for your Too Fresh To Waste account. However, your
          account was created using <strong>{providerLabel} Sign-In</strong> — no password is
          associated with it.
        </Text>

        <Text style={styles.paragraph}>
          To access your account, simply sign in with {providerLabel} using the button below.
        </Text>

        <Section style={styles.buttonContainer}>
          <Button href={loginUrl} style={styles.button}>
            Sign in with {providerLabel}
          </Button>
        </Section>

        <Section style={styles.notice}>
          <Text style={styles.noticeText}>
            If you did not request this, no action is needed — your account is safe and no changes
            were made.
          </Text>
        </Section>
      </Section>
    </EmailBase>
  );
}

export default OAuthSignInEmail;

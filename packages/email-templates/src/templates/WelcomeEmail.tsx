import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailBase, styles } from '../components/EmailBase';

export interface WelcomeEmailProps {
  firstName: string;
  appUrl: string;
}

export function WelcomeEmail({ firstName, appUrl }: WelcomeEmailProps) {
  return (
    <EmailBase preview={`Welcome to Too Fresh To Waste, ${firstName}!`}>
      <Section style={styles.content}>
        <Text style={styles.greeting}>Welcome, {firstName}! 🎉</Text>

        <Text style={styles.paragraph}>
          Your Too Fresh To Waste account has been successfully verified and is ready to use.
        </Text>

        <Text style={styles.paragraph}>Here&apos;s what you can do now:</Text>

        <Section style={{ ...styles.notice, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <Text style={{ ...styles.noticeText, color: '#166534' }}>
            🥘 Browse surplus food offers from local restaurants and bakeries
            <br />
            💰 Purchase quality meals at up to 70% off regular prices
            <br />
            🌍 Help reduce food waste in your community
            <br />⭐ Rate and review your favourite merchants
          </Text>
        </Section>

        <Section style={styles.buttonContainer}>
          <Button href={appUrl} style={styles.button}>
            🚀 Start Exploring
          </Button>
        </Section>
      </Section>
    </EmailBase>
  );
}

export default WelcomeEmail;

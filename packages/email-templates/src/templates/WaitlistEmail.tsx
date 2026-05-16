import { Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailBase, styles } from '../components/EmailBase';

export interface WaitlistEmailProps {
  email: string;
}

export function WaitlistEmail({ email }: WaitlistEmailProps) {
  return (
    <EmailBase preview="You're on the Too Fresh To Waste launch list! 🚀">
      <Section style={styles.content}>
        <Text style={styles.greeting}>You&apos;re on the list! 🚀</Text>

        <Text style={styles.paragraph}>
          Thank you for signing up — we&apos;ve saved your spot on the Too Fresh To Waste launch
          list.
        </Text>

        <Section style={{ ...styles.notice, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <Text style={{ ...styles.noticeText, color: '#166534' }}>
            📅 <strong>Launch date: June 6, 2026</strong>
            <br />
            You&apos;ll receive an email the moment the app is live and ready to download.
          </Text>
        </Section>

        <Text style={styles.paragraph}>Here&apos;s what&apos;s waiting for you:</Text>

        <Section style={styles.notice}>
          <Text style={styles.noticeText}>
            🛍️ Surprise bags from restaurants & bakeries near you — up to 70% off
            <br />
            📍 Discover local businesses reducing food waste every day
            <br />
            🌱 Earn points, win prizes, and help the planet — all with one app
          </Text>
        </Section>

        <Text style={{ ...styles.paragraph, color: '#6b7280', fontSize: '13px' }}>
          Registered email: {email}
        </Text>
      </Section>
    </EmailBase>
  );
}

export default WaitlistEmail;

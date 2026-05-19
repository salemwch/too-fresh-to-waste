import { Section, Text } from '@react-email/components';
import * as React from 'react';

import { EmailBase, styles } from '../components/EmailBase';

export interface GoogleLinkedEmailProps {
  firstName: string;
}

export function GoogleLinkedEmail({ firstName }: GoogleLinkedEmailProps) {
  return (
    <EmailBase preview={`Google Sign-In linked to your Too Fresh To Waste account`}>
      <Section style={styles.content}>
        <Text style={styles.greeting}>Hi {firstName},</Text>

        <Text style={styles.paragraph}>
          Your Too Fresh To Waste account has been linked to Google Sign-In. You can now sign in
          quickly using your Google account.
        </Text>

        <Section style={{ ...styles.notice, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <Text style={{ ...styles.noticeText, color: '#166534' }}>
            If you did not initiate this, please contact our support team immediately.
          </Text>
        </Section>

        <Text style={styles.paragraph}>
          Best regards,
          <br />
          The Too Fresh To Waste Team
        </Text>
      </Section>
    </EmailBase>
  );
}

export default GoogleLinkedEmail;

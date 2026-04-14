import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Img,
  Hr,
} from '@react-email/components';
import * as React from 'react';

const BRAND_COLOR = '#005250';
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

interface EmailBaseProps {
  preview: string;
  children: React.ReactNode;
}

export function EmailBase({ preview, children }: EmailBaseProps) {
  return (
    <Html lang='en'>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.logo}>🍽️ Too Fresh To Waste</Text>
          </Section>

          {/* Content slot */}
          {children}

          {/* Footer */}
          <Hr style={styles.divider} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Best regards,
              <br />
              <strong>The Too Fresh To Waste Team</strong>
            </Text>
            <Text style={styles.footerTagline}>
              Together, we&apos;re making a difference in reducing food waste!
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const styles = {
  body: {
    backgroundColor: '#f4f4f5',
    fontFamily: FONT_FAMILY,
    margin: '0',
    padding: '20px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    margin: '0 auto',
    maxWidth: '600px',
    overflow: 'hidden' as const,
  },
  header: {
    backgroundColor: BRAND_COLOR,
    padding: '28px 40px',
    textAlign: 'center' as const,
  },
  logo: {
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: '700',
    margin: '0',
    letterSpacing: '-0.3px',
  },
  content: {
    padding: '36px 40px 24px',
  },
  greeting: {
    color: '#111827',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 16px',
  },
  paragraph: {
    color: '#374151',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: '0 0 16px',
  },
  buttonContainer: {
    textAlign: 'center' as const,
    margin: '32px 0',
  },
  button: {
    backgroundColor: BRAND_COLOR,
    borderRadius: '8px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: '600',
    padding: '14px 32px',
    textDecoration: 'none',
  },
  notice: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '14px 18px',
    margin: '20px 0',
  },
  noticeText: {
    color: '#92400e',
    fontSize: '13px',
    margin: '0',
    lineHeight: '1.6',
  },
  fallbackLabel: {
    color: '#6b7280',
    fontSize: '13px',
    margin: '24px 0 6px',
  },
  fallbackUrl: {
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    color: '#374151',
    fontFamily: 'monospace',
    fontSize: '12px',
    padding: '10px 14px',
    wordBreak: 'break-all' as const,
  },
  divider: {
    borderColor: '#e5e7eb',
    borderTopWidth: '1px',
    margin: '0 40px',
  },
  footer: {
    padding: '24px 40px 32px',
    textAlign: 'center' as const,
  },
  footerText: {
    color: '#6b7280',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 8px',
  },
  footerTagline: {
    color: '#9ca3af',
    fontSize: '12px',
    fontStyle: 'italic',
    margin: '0',
  },
} as const;

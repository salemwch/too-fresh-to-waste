/**
 * Refresh Token Test Screen
 *
 * A dedicated screen for testing and verifying the refresh token mechanism.
 * Add this screen to your navigator temporarily for testing.
 *
 * To use:
 * 1. Import this screen in your navigator
 * 2. Add it as a route (e.g., in MainStack)
 * 3. Navigate to it after logging in
 * 4. Run the tests
 * 5. Remove it from production build
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useSelector } from 'react-redux';

import { Button, Card, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { runRefreshTokenTests, quickRefreshTest } from '@/utils/testRefreshToken';

import type { RootState } from '@/types';

export const RefreshTokenTestScreen: React.FC = () => {
  const theme = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<string>('');

  const { tokens, sessionExpiresAt, isAuthenticated } = useSelector((state: RootState) => state.auth);

  /**
   * Run full test suite
   */
  const handleRunFullTests = async () => {
    setIsRunning(true);
    setTestResults('Running tests... Please check console for detailed logs.\n\n');

    try {
      const { summary, results } = await runRefreshTokenTests();

      let report = '═══ TEST RESULTS ═══\n\n';
      report += `Total: ${summary.total}\n`;
      report += `✅ Passed: ${summary.passed}\n`;
      report += `❌ Failed: ${summary.failed}\n\n`;

      results.forEach((result, index) => {
        const icon = result.passed ? '✅' : '❌';
        report += `${icon} Test ${index + 1}: ${result.testName}\n`;
        report += `   ${result.message}\n\n`;
      });

      if (summary.failed === 0) {
        report += '🎉 ALL TESTS PASSED!\n';
        report += 'Refresh token is working correctly.';
      } else {
        report += '⚠️ SOME TESTS FAILED\n';
        report += 'Check console for detailed error information.';
      }

      setTestResults(report);

      // Show alert with summary
      Alert.alert(
        summary.failed === 0 ? 'Tests Passed ✅' : 'Tests Failed ❌',
        `${summary.passed}/${summary.total} tests passed. See screen for details.`,
      );
    } catch (error) {
      const errorMsg = `Test Error: ${(error as Error).message}`;
      setTestResults(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Run quick test (interceptor only)
   */
  const handleQuickTest = async () => {
    setIsRunning(true);
    setTestResults('Running quick test... Check console for logs.\n\n');

    try {
      const passed = await quickRefreshTest();

      const report = passed
        ? '✅ QUICK TEST PASSED\n\nThe interceptor correctly:\n1. Detected 401 error\n2. Triggered refresh\n3. Got new token\n4. Retried request\n5. Request succeeded'
        : '❌ QUICK TEST FAILED\n\nThe interceptor did not work correctly.\nCheck console for error details.';

      setTestResults(report);

      Alert.alert(passed ? 'Quick Test Passed ✅' : 'Quick Test Failed ❌', report);
    } catch (error) {
      const errorMsg = `Test Error: ${(error as Error).message}`;
      setTestResults(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Show current token info
   */
  const getTokenInfo = () => {
    if (!tokens) {
      return 'No tokens found. Please login first.';
    }

    const now = new Date();
    const expiresAt = sessionExpiresAt ? new Date(sessionExpiresAt) : null;
    const minutesRemaining = expiresAt ? (expiresAt.getTime() - now.getTime()) / 1000 / 60 : 0;

    return `Access Token: ${tokens.accessToken.substring(0, 30)}...\n\nRefresh Token: ${tokens.refreshToken.substring(0, 30)}...\n\nExpires At: ${sessionExpiresAt || 'Unknown'}\n\nTime Remaining: ${minutesRemaining.toFixed(2)} minutes`;
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Card style={styles.card}>
          <Text variant="title" size="lg" weight="bold" align="center" style={styles.title}>
            ⚠️ Not Authenticated
          </Text>
          <Text variant="body" size="md" align="center" style={styles.message}>
            Please login first to test refresh token functionality.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Text variant="title" size="lg" weight="bold" style={styles.title}>
          🧪 Refresh Token Test
        </Text>
        <Text variant="body" size="md" style={styles.description}>
          This screen allows you to test and verify that the automatic token refresh mechanism is
          working correctly.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="title" size="md" weight="semibold" style={styles.sectionTitle}>
          📊 Current Token Status
        </Text>
        <Text variant="body" size="sm" style={styles.tokenInfo}>
          {getTokenInfo()}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="title" size="md" weight="semibold" style={styles.sectionTitle}>
          🚀 Run Tests
        </Text>

        <Button
          variant="primary"
          size="lg"
          onPress={handleQuickTest}
          disabled={isRunning}
          loading={isRunning}
          style={styles.button}
        >
          Quick Test (Interceptor Only)
        </Button>

        <Text variant="body" size="sm" color="secondary" style={styles.buttonDescription}>
          Tests if the 401 interceptor correctly triggers token refresh
        </Text>

        <Button
          variant="secondary"
          size="lg"
          onPress={handleRunFullTests}
          disabled={isRunning}
          loading={isRunning}
          style={styles.button}
        >
          Full Test Suite (All 5 Tests)
        </Button>

        <Text variant="body" size="sm" color="secondary" style={styles.buttonDescription}>
          Runs comprehensive tests on storage, expiration, endpoint, interceptor, and persistence
        </Text>
      </Card>

      {testResults !== '' && (
        <Card style={styles.card}>
          <Text variant="title" size="md" weight="semibold" style={styles.sectionTitle}>
            📋 Test Results
          </Text>
          <Text
            variant="body"
            size="sm"
            style={[styles.results, { fontFamily: 'monospace' }]}
          >
            {testResults}
          </Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text variant="title" size="md" weight="semibold" style={styles.sectionTitle}>
          📝 Notes
        </Text>
        <Text variant="body" size="sm" style={styles.note}>
          • Tests will log detailed information to the console
          {'\n'}• Check React Native debugger or Metro logs
          {'\n'}• The Quick Test simulates a 401 error
          {'\n'}• Full test includes storage, endpoint, and interceptor tests
          {'\n'}• Remove this screen before production deployment
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  title: {
    marginBottom: 12,
  },
  description: {
    lineHeight: 22,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  tokenInfo: {
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  button: {
    marginBottom: 8,
  },
  buttonDescription: {
    marginBottom: 16,
    lineHeight: 18,
  },
  results: {
    lineHeight: 20,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  note: {
    lineHeight: 20,
  },
  message: {
    lineHeight: 22,
  },
});

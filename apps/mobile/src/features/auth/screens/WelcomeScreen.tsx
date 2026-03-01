/**
 * Welcome Screen
 * First screen users see when opening the app for the first time
 * Displays branding and navigates to registration
 *
 * DEVICE-LEVEL ONBOARDING:
 * - Only shown once per device (not per user)
 * - Uses MMKV for synchronous flag persistence
 * - Survives login/logout cycles
 * - Only reset on app reinstall or manual storage clear
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Image, Dimensions, StatusBar, Pressable } from 'react-native';

import BagImage from '@/assets/images/Bag.png';
import LeafIcon from '@/assets/images/leaf.png';
import RocketIcon from '@/assets/images/rocket.png';
import { Button, Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { onboardingStorage } from '@/storage/onboardingStorage';

import type { WelcomeScreenNavigationProp } from '@/navigation/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const [isNavigating, setIsNavigating] = useState(false);

  /**
   * Mark onboarding as complete and navigate to Register screen
   * Uses navigation.replace to prevent going back to Welcome screen
   */
  const handleGetStarted = useCallback(() => {
    // Prevent double-tap
    if (isNavigating) return;
    setIsNavigating(true);

    // Mark welcome screen as seen (device-level flag)
    onboardingStorage.markWelcomeSeen();

    // Use replace instead of navigate to prevent back navigation to Welcome
    navigation.replace('Register');
  }, [navigation, isNavigating]);

  /**
   * Mark onboarding as complete and navigate to Register screen
   * Alternative entry point to registration (same as Get Started button)
   * Uses navigation.replace to prevent going back to Welcome screen
   */
  const handleSignUp = useCallback(() => {
    // Prevent double-tap
    if (isNavigating) return;
    setIsNavigating(true);

    // Mark welcome screen as seen (device-level flag)
    onboardingStorage.markWelcomeSeen();

    // Use replace instead of navigate to prevent back navigation to Welcome
    navigation.replace('Register');
  }, [navigation, isNavigating]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      <StatusBar barStyle='light-content' backgroundColor={theme.colors.primary} />

      {/* Title Text - at the top */}
      <View style={styles.titleContainer}>
        <Text variant='display.medium' weight='bold' style={styles.titleText}>
          Save food
        </Text>
        <Text variant='display.medium' weight='bold' style={styles.titleText}>
          Save money
        </Text>
      </View>

      {/* Grocery Bag Image - BEHIND the white section (z-index 1) */}
      <View style={styles.bagContainer}>
        <Image
          source={BagImage}
          style={styles.bagImage}
          resizeMode='contain'
          accessibilityLabel='Grocery bag full of fresh food'
        />
      </View>

      {/* White Section with curved top - ON TOP of the bag (z-index 2) */}
      <View style={styles.whiteSection}>
        <View style={styles.bottomContent}>
          {/* Leaf Icon */}
          <Image
            source={LeafIcon}
            style={styles.leafIcon}
            resizeMode='contain'
            accessibilityLabel='Leaf icon'
          />

          {/* App Name */}
          <Text
            variant='headline.large'
            weight='bold'
            style={[styles.appName, { color: theme.colors.primary }]}
          >
            Too Fresh To Waste
          </Text>

          {/* Tagline */}
          <Text variant='body.large' style={[styles.tagline, { color: theme.colors.primary }]}>
            Buy surplus food{'\n'}at lower prices
          </Text>

          {/* Get Started Button */}
          <Button
            variant='primary'
            size='lg'
            onPress={handleGetStarted}
            style={styles.getStartedButton}
            textStyle={styles.getStartedButtonText}
            rightIcon={<Image source={RocketIcon} style={styles.rocketIcon} resizeMode='contain' />}
            disabled={isNavigating}
            testID='welcome-get-started-button'
          >
            Get Started
          </Button>

          {/* Sign Up Link */}
          <View style={styles.signInContainer}>
            <Pressable onPress={handleSignUp}>
              <Text
                variant='body.medium'
                weight='semibold'
                style={[styles.signInText, { color: theme.colors.primary }]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    alignItems: 'center',
    paddingTop: SCREEN_HEIGHT * 0.05,
    zIndex: 1,
  },
  titleText: {
    color: WHITE,
    textAlign: 'center',
    lineHeight: 69,
  },
  // Bag is positioned to extend into the white section area
  // z-index 1 means it's BEHIND the white section (z-index 2)
  bagContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * -0.07,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  // Large bag that extends down past where white section starts
  bagImage: {
    width: SCREEN_WIDTH * 3,
    height: SCREEN_HEIGHT * 1.1,
  },
  // White section with curved top edge - covers bottom of bag
  // z-index 2 means it's ON TOP of the bag
  whiteSection: {
    position: 'absolute',
    bottom: 0,
    left: -30,
    right: -30,
    height: SCREEN_HEIGHT * 0.42,
    backgroundColor: WHITE,
    borderTopLeftRadius: SCREEN_WIDTH,
    borderTopRightRadius: SCREEN_WIDTH,
    zIndex: 2,
  },
  bottomContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    justifyContent: 'flex-start',
  },
  leafIcon: {
    width: 48,
    height: 40,
    marginBottom: 8,
    transform: [{ scale: 3.5 }], // Scale up visually without affecting layout
  },
  appName: {
    textAlign: 'center',
    marginBottom: 4,
  },
  tagline: {
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 24,
    fontSize: 25,
  },
  getStartedButton: {
    minWidth: 200,
    paddingHorizontal: 32,
  },
  getStartedButtonText: {
    fontSize: 25, // Increase this value for bigger text
    fontWeight: 'bold',
  },
  rocketIcon: {
    width: 32,
    height: 32,
    transform: [{ scale: 2.5 }],
    marginLeft: 8,
  },
  signInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  signInText: {
    fontSize: 18, // Increase this value for bigger text
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreen;

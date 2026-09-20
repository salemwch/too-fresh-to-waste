/**
 * Onboarding — one screen, three pages, one horizontal pager.
 *
 * WHY THIS IS ONE ROUTE AND NOT THREE
 * -----------------------------------
 * It used to be three stack screens with the arrows calling `navigate()`. That
 * cannot follow a finger: nothing moves until the gesture ends, and then the
 * whole screen jumps. A pager is what every onboarding flow the user has seen
 * behaves like — the pages track the drag, a half-swipe can be abandoned, and
 * the release snaps to the nearest page.
 *
 * `pagingEnabled` on React Native's own ScrollView does all of that natively,
 * on the UI thread, with no pager library and no Reanimated. The scroll handler
 * below only reads which page settled; it never drives the movement.
 *
 * The three pages keep the bottom bars they already had — page 1 its "Get
 * Started" button, page 2 its arrows, page 3 its "Create Account" button — so
 * they travel with their page. Nothing about the visual design moved; only the
 * mechanism underneath it did.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { colorTokens } from '@/design-system/tokens/colors';
import { isAppRTL } from '@/i18n/direction';
import { onboardingStorage } from '@/storage/onboardingStorage';

import { OnboardingPageOne } from '../components/onboarding/OnboardingPageOne';
import { OnboardingPageThree } from '../components/onboarding/OnboardingPageThree';
import { OnboardingPageTwo } from '../components/onboarding/OnboardingPageTwo';
import {
  ONBOARDING_PAGE_COUNT,
  offsetForPage,
  pageIndexFromOffset,
} from '../utils/onboardingPager';

import type { WelcomeScreenNavigationProp } from '@/navigation/types';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const PRIMARY = colorTokens.base.primary[500];

interface OnboardingScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  /*
   * Read once per render rather than per callback: the value cannot change
   * without a restart (see `@/i18n/direction`), and it feeds four call sites
   * that must all agree.
   */
  const rtl = isAppRTL();

  /*
   * Guards the two terminal actions only. Moving between pages is not guarded —
   * it is a scroll, and rate-limiting a scroll is how a pager starts feeling
   * broken.
   */
  const [isLeaving, setIsLeaving] = useState(false);

  // React Navigation keeps this screen mounted, so the flag has to be cleared
  // on focus or a user who comes back finds every exit dead. See
  // .claude/rules/mobile.md rule 10.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsLeaving(false);
    });
    return unsubscribe;
  }, [navigation]);

  const goToPage = useCallback(
    (next: number) => {
      const offset = offsetForPage(next, width, ONBOARDING_PAGE_COUNT, rtl);
      scrollRef.current?.scrollTo({ x: offset, animated: true });
      // Optimistic: `onMomentumScrollEnd` confirms it, but the dots and the
      // arrows should respond to the tap immediately, not one animation later.
      setPage(prev => (prev === next ? prev : next));
    },
    [width, rtl],
  );

  const handleNext = useCallback(() => {
    goToPage(Math.min(page + 1, ONBOARDING_PAGE_COUNT - 1));
  }, [goToPage, page]);

  const handlePrevious = useCallback(() => {
    goToPage(Math.max(page - 1, 0));
  }, [goToPage, page]);

  const handleSkip = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    onboardingStorage.markWelcomeSeen();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }, [navigation, isLeaving]);

  const handleCreateAccount = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    onboardingStorage.markWelcomeSeen();
    navigation.reset({ index: 1, routes: [{ name: 'Login' }, { name: 'Register' }] });
  }, [navigation, isLeaving]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settled = pageIndexFromOffset(
        event.nativeEvent.contentOffset.x,
        width,
        ONBOARDING_PAGE_COUNT,
        rtl,
      );
      setPage(prev => (prev === settled ? prev : settled));
    },
    [width, rtl],
  );

  /*
   * Hardware back steps back a page instead of leaving onboarding. Without
   * this, back on page 3 drops the user at the login screen having skipped the
   * flow, which is not what "back" means anywhere else in the app.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 0) return false; // let the OS close the app, as before
      handlePrevious();
      return true;
    });
    return () => subscription.remove();
  }, [page, handlePrevious]);

  /*
   * Rotation changes the page width, and the existing scroll offset was
   * measured against the old one — so without this the user lands between two
   * pages after a rotate.
   */
  useEffect(() => {
    scrollRef.current?.scrollTo({
      x: offsetForPage(page, width, ONBOARDING_PAGE_COUNT, rtl),
      animated: false,
    });
    // `page` deliberately absent: this realigns on a width change, and including
    // it would fight the momentum handler on every ordinary swipe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, rtl]);

  const pageStyle = { width };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode='never'
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        // Keeps all three mounted: they are three static screens, and unmounting
        // them mid-drag is what makes a pager flicker.
        removeClippedSubviews={false}
        accessibilityRole='tablist'
      >
        <View style={pageStyle}>
          <OnboardingPageOne onNext={handleNext} onSkip={handleSkip} isLeaving={isLeaving} />
        </View>
        <View style={pageStyle}>
          <OnboardingPageTwo
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            isLeaving={isLeaving}
          />
        </View>
        <View style={pageStyle}>
          <OnboardingPageThree
            onPrevious={handlePrevious}
            onCreateAccount={handleCreateAccount}
            isLeaving={isLeaving}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
});

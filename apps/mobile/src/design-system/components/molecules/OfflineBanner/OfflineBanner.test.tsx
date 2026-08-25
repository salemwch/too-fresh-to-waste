/**
 * The app used to mount two different offline banners at once: a self-managing
 * one in App.tsx that subscribed to NetInfo itself, and this controlled one in
 * RootNavigator driven by `showBanner`. Both rendered on a real offline event.
 *
 * The duplicate was removed in favour of this component, because RootNavigator
 * already tracks device connectivity *and* API network errors, so it covers
 * both triggers where the other covered only one.
 *
 * The one thing the deleted component did better was accessibility and
 * translation: it carried `accessibilityRole='alert'` and a translated label,
 * and this one carried neither. These tests pin that behaviour so the
 * consolidation cannot quietly regress it.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { OfflineBanner } from './OfflineBanner';

jest.mock('@/design-system/providers', () => ({
  useTheme: () => ({
    colors: { error: '#D32F2F', onError: '#FFFFFF', onSurface: '#212121' },
  }),
}));

jest.mock('@/design-system/components/atoms/Icon/Icon', () => ({
  Icon: () => null,
}));

describe('visibility', () => {
  it('renders nothing while visible is false', () => {
    render(<OfflineBanner visible={false} />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('renders when visible', () => {
    render(<OfflineBanner visible message='No internet connection' />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });
});

describe('accessibility', () => {
  it('announces as an alert', () => {
    render(<OfflineBanner visible message='No internet connection' />);
    expect(screen.getByTestId('offline-banner').props['accessibilityRole']).toBe('alert');
  });

  it('is a live region, so a screen reader reads it without focus moving', () => {
    render(<OfflineBanner visible message='No internet connection' />);
    expect(screen.getByTestId('offline-banner').props['accessibilityLiveRegion']).toBe('polite');
  });

  it('falls back to the message as its accessible name', () => {
    render(<OfflineBanner visible message='No internet connection' />);
    expect(screen.getByTestId('offline-banner').props['accessibilityLabel']).toBe(
      'No internet connection',
    );
  });

  it('prefers an explicit accessibilityLabel over the message', () => {
    render(
      <OfflineBanner
        visible
        message='Reconnecting…'
        accessibilityLabel='You are offline'
        accessibilityHint=''
      />,
    );
    expect(screen.getByTestId('offline-banner').props['accessibilityLabel']).toBe(
      'You are offline',
    );
  });
});

describe('message', () => {
  it('shows the message it is given', () => {
    render(<OfflineBanner visible message='Aucune connexion Internet' />);
    expect(screen.getByText('Aucune connexion Internet')).toBeTruthy();
  });

  it('renders an Arabic message unchanged', () => {
    render(<OfflineBanner visible message='لا يوجد اتصال بالإنترنت' />);
    expect(screen.getByText('لا يوجد اتصال بالإنترنت')).toBeTruthy();
  });

  /*
   * The default is English and this component does no lookup, so callers must
   * translate. RootNavigator does. Asserted so the default is never mistaken
   * for a localized string.
   */
  it('has an untranslated English default that callers are expected to override', () => {
    render(<OfflineBanner visible />);
    expect(screen.getByText("You're offline. Trying to reconnect…")).toBeTruthy();
  });
});

describe('testID', () => {
  it('accepts an override', () => {
    render(<OfflineBanner visible testID='custom-banner' />);
    expect(screen.getByTestId('custom-banner')).toBeTruthy();
  });
});

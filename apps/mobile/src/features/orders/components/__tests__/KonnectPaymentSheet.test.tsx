import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockText = ({ children, style }: { children?: unknown; style?: any }) =>
    mockReact.createElement(mockRN.Text, { style }, children as React.ReactNode);
  const MockIcon = () => mockReact.createElement(mockRN.View, null);
  return { Text: MockText, Icon: MockIcon };
});

/* colorTokens is deliberately NOT mocked.
 *
 * It is a pure constants module with no native dependency, so there was nothing
 * to stub - and the stub only carried `base.primary`. When MD2 replaced this
 * component's raw greys with `base.neutral` reads, the partial mock made the
 * whole suite fail to load. A fake of a constant can only ever drift from it. */

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/utils/logger', () => ({
  Logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

jest.mock('react-native-webview', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  const MockWebView = (props: Record<string, unknown>) =>
    mockReact.createElement(mockRN.View, { testID: 'webview', ...props });
  return { __esModule: true, default: MockWebView, WebView: MockWebView };
});

import { KonnectPaymentSheet } from '../KonnectPaymentSheet';

const PAY_URL = 'https://konnect.pay/checkout/abc';

describe('KonnectPaymentSheet', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders a WebView with the payment URL when visible', () => {
    const { getByTestId } = render(
      <KonnectPaymentSheet
        visible
        payUrl={PAY_URL}
        onDismiss={jest.fn()}
        onPaymentFailed={jest.fn()}
      />,
    );

    const webview = getByTestId('webview');
    expect(webview.props['source']).toEqual({ uri: PAY_URL });
  });

  it('does not render when not visible', () => {
    const { queryByTestId } = render(
      <KonnectPaymentSheet
        visible={false}
        payUrl={PAY_URL}
        onDismiss={jest.fn()}
        onPaymentFailed={jest.fn()}
      />,
    );

    expect(queryByTestId('webview')).toBeNull();
  });

  it('does not render with an empty payUrl', () => {
    const { queryByTestId } = render(
      <KonnectPaymentSheet visible payUrl='' onDismiss={jest.fn()} onPaymentFailed={jest.fn()} />,
    );

    expect(queryByTestId('webview')).toBeNull();
  });

  it('calls onDismiss when success deep link is intercepted', () => {
    const onDismiss = jest.fn();
    const onPaymentFailed = jest.fn();

    const { getByTestId } = render(
      <KonnectPaymentSheet
        visible
        payUrl={PAY_URL}
        onDismiss={onDismiss}
        onPaymentFailed={onPaymentFailed}
      />,
    );

    const webview = getByTestId('webview');
    const handler = webview.props['onShouldStartLoadWithRequest'] as (event: {
      url: string;
    }) => boolean;
    const shouldLoad = handler({
      url: 'toofreshtowaste://order-payment-success?orderId=abc123',
    });

    expect(shouldLoad).toBe(false);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPaymentFailed).not.toHaveBeenCalled();
  });

  it('calls onPaymentFailed when failure deep link is intercepted', () => {
    const onDismiss = jest.fn();
    const onPaymentFailed = jest.fn();

    const { getByTestId } = render(
      <KonnectPaymentSheet
        visible
        payUrl={PAY_URL}
        onDismiss={onDismiss}
        onPaymentFailed={onPaymentFailed}
      />,
    );

    const webview = getByTestId('webview');
    const handler = webview.props['onShouldStartLoadWithRequest'] as (event: {
      url: string;
    }) => boolean;
    const shouldLoad = handler({
      url: 'toofreshtowaste://order-payment-failed?orderId=abc123',
    });

    expect(shouldLoad).toBe(false);
    expect(onPaymentFailed).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('allows normal HTTPS navigations', () => {
    const { getByTestId } = render(
      <KonnectPaymentSheet
        visible
        payUrl={PAY_URL}
        onDismiss={jest.fn()}
        onPaymentFailed={jest.fn()}
      />,
    );

    const webview = getByTestId('webview');
    const handler = webview.props['onShouldStartLoadWithRequest'] as (event: {
      url: string;
    }) => boolean;
    const shouldLoad = handler({
      url: 'https://konnect.network/checkout/step2',
    });

    expect(shouldLoad).toBe(true);
  });

  it('calls onPaymentFailed when close button is pressed', async () => {
    const onPaymentFailed = jest.fn();

    const { getByLabelText } = render(
      <KonnectPaymentSheet
        visible
        payUrl={PAY_URL}
        onDismiss={jest.fn()}
        onPaymentFailed={onPaymentFailed}
      />,
    );

    fireEvent.press(getByLabelText('Close payment'));
    await waitFor(() => expect(onPaymentFailed).toHaveBeenCalledTimes(1));
  });
});

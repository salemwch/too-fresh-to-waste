/**
 * Google Analytics 4 Event Tracking Utilities
 *
 * Type-safe wrapper for tracking custom events in Google Analytics 4.
 * Only sends events when GA4 is properly configured and loaded.
 *
 * @see https://developers.google.com/analytics/devguides/collection/ga4/events
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Standard GA4 event parameters
 */
export interface GAEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  currency?: string;
  transaction_id?: string;
  items?: Array<{
    item_id: string;
    item_name: string;
    item_category?: string;
    price?: number;
    quantity?: number;
  }>;
  [key: string]: string | number | boolean | object | undefined;
}

/**
 * E-commerce event parameters for GA4
 */
export type GAEcommerceParams = GAEventParams;

/**
 * Check if Google Analytics is loaded and available
 */
export function isGALoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Send a custom event to Google Analytics
 *
 * @param eventName - Name of the event (e.g., 'button_click', 'form_submit')
 * @param params - Event parameters
 *
 * @example
 * ```ts
 * trackEvent('signup_complete', {
 *   event_category: 'engagement',
 *   event_label: 'user_registration',
 *   value: 1
 * });
 * ```
 */
export function trackEvent(eventName: string, params?: GAEventParams): void {
  if (!isGALoaded()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA] Event tracked (gtag not loaded):', eventName, params);
    }
    return;
  }

  try {
    window.gtag!('event', eventName, params);

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA] Event tracked:', eventName, params);
    }
  } catch (error) {
    console.error('[GA] Error tracking event:', error);
  }
}

/**
 * Track page views manually (useful for client-side routing)
 *
 * @param url - Page URL
 * @param title - Page title
 *
 * @example
 * ```ts
 * trackPageView('/about', 'About Us');
 * ```
 */
export function trackPageView(url: string, title?: string): void {
  if (!isGALoaded()) {
    return;
  }

  try {
    const measurementId = process.env['NEXT_PUBLIC_GA_MEASUREMENT_ID'];
    if (!measurementId) {
      return;
    }

    window.gtag!('config', measurementId, {
      page_path: url,
      page_title: title,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[GA] Page view tracked:', url, title);
    }
  } catch (error) {
    console.error('[GA] Error tracking page view:', error);
  }
}

/**
 * Track user signup/registration
 */
export function trackSignup(method: 'email' | 'google' | 'facebook' | 'apple'): void {
  trackEvent('sign_up', {
    event_category: 'engagement',
    event_label: method,
    method,
  });
}

/**
 * Track user login
 */
export function trackLogin(method: 'email' | 'google' | 'facebook' | 'apple'): void {
  trackEvent('login', {
    event_category: 'engagement',
    event_label: method,
    method,
  });
}

/**
 * Track search queries
 */
export function trackSearch(searchTerm: string): void {
  trackEvent('search', {
    event_category: 'engagement',
    event_label: searchTerm,
    search_term: searchTerm,
  });
}

/**
 * Track button clicks
 */
export function trackButtonClick(buttonName: string, location?: string): void {
  trackEvent('button_click', {
    event_category: 'engagement',
    event_label: buttonName,
    button_name: buttonName,
    button_location: location,
  });
}

/**
 * Track form submissions
 */
export function trackFormSubmit(formName: string, success: boolean = true): void {
  trackEvent('form_submit', {
    event_category: 'engagement',
    event_label: formName,
    form_name: formName,
    form_success: success,
  });
}

/**
 * Track outbound link clicks
 */
export function trackOutboundLink(url: string, linkText?: string): void {
  trackEvent('click', {
    event_category: 'outbound',
    event_label: linkText || url,
    link_url: url,
    link_text: linkText,
  });
}

/**
 * Track file downloads
 */
export function trackDownload(fileName: string, fileType?: string): void {
  trackEvent('file_download', {
    event_category: 'engagement',
    event_label: fileName,
    file_name: fileName,
    file_type: fileType,
  });
}

/**
 * Track video interactions
 */
export function trackVideoEvent(
  action: 'play' | 'pause' | 'complete',
  videoTitle: string,
  videoUrl?: string
): void {
  trackEvent(`video_${action}`, {
    event_category: 'video',
    event_label: videoTitle,
    video_title: videoTitle,
    video_url: videoUrl,
  });
}

/**
 * Track e-commerce: view item
 */
export function trackViewItem(itemId: string, itemName: string, price?: number): void {
  const params: GAEventParams = {
    event_category: 'ecommerce',
    currency: 'CAD',
    items: [
      {
        item_id: itemId,
        item_name: itemName,
        ...(price !== undefined && { price }),
      },
    ],
  };
  if (price !== undefined) {
    params.value = price;
  }
  trackEvent('view_item', params);
}

/**
 * Track e-commerce: add to cart
 */
export function trackAddToCart(
  itemId: string,
  itemName: string,
  price: number,
  quantity: number = 1
): void {
  trackEvent('add_to_cart', {
    event_category: 'ecommerce',
    currency: 'CAD',
    value: price * quantity,
    items: [
      {
        item_id: itemId,
        item_name: itemName,
        price,
        quantity,
      },
    ],
  });
}

/**
 * Track e-commerce: begin checkout
 */
export function trackBeginCheckout(value: number, items?: GAEventParams['items']): void {
  const params: GAEventParams = {
    event_category: 'ecommerce',
    currency: 'CAD',
    value,
  };
  if (items) {
    params.items = items;
  }
  trackEvent('begin_checkout', params);
}

/**
 * Track e-commerce: purchase
 */
export function trackPurchase(
  transactionId: string,
  value: number,
  items?: GAEventParams['items']
): void {
  const params: GAEventParams = {
    event_category: 'ecommerce',
    transaction_id: transactionId,
    currency: 'CAD',
    value,
  };
  if (items) {
    params.items = items;
  }
  trackEvent('purchase', params);
}

/**
 * Track exceptions and errors
 */
export function trackException(description: string, fatal: boolean = false): void {
  trackEvent('exception', {
    event_category: 'error',
    description,
    fatal,
  });
}

/**
 * Track timing/performance metrics
 */
export function trackTiming(
  name: string,
  value: number,
  category: string = 'performance'
): void {
  trackEvent('timing_complete', {
    event_category: category,
    event_label: name,
    name,
    value,
  });
}

import { readApiError } from '@foodwaste/shared';

/**
 * The message to show for a failed sign-in.
 *
 * The backend already answers in the page's language (the API client sends
 * Accept-Language) with copy written for users, including the lockout, the
 * suspended account and the unverified email - so it is shown as is. This
 * used to map each error type to a hardcoded English sentence, which every
 * French and Arabic user saw. Translated fallbacks cover a response with no
 * message at all (the server never answered, or a proxy error page).
 */
export function parseLoginError(error: unknown, t: (key: string) => string): string {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (!response?.status) {
    return t('networkError');
  }
  return readApiError(response.data).message ?? t('loginError');
}

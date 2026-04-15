import type { AbstractIntlMessages } from 'next-intl';

/**
 * Pick a subset of top-level namespaces from the full messages object.
 * Used to pass only the translations a route group actually needs to
 * NextIntlClientProvider, reducing the serialised JSON payload per page.
 */
export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  return Object.fromEntries(
    namespaces.filter(ns => ns in messages).map(ns => [ns, messages[ns]]),
  ) as AbstractIntlMessages;
}

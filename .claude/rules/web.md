---
paths:
  - 'apps/web/**/*.ts'
  - 'apps/web/**/*.tsx'
---

# Web Coding Rules

Rules specific to `apps/web`. Architecture is documented in project CLAUDE.md —
these are coding-level decisions only.

1. **No tokens in JavaScript** — auth uses HttpOnly cookies set by backend.
   Never store tokens in localStorage, sessionStorage, or Zustand. Use
   `withCredentials: true` on all API calls.
2. **Routing**: always use next-intl's `useRouter()`, `Link`, `usePathname()`
   from `@/i18n/routing` — they handle locale prefix automatically. Never use
   `next/link` or `next/navigation` directly.
3. **Route protection**: server-side via middleware (Edge JWT verification) +
   client-side via `<AuthGuard>` and `<RoleGuard>` in layout files. Both layers
   are required.
4. **Query keys**: use centralized factory (`dashboardKeys`) for all TanStack
   Query keys. Invalidate via factory, not hardcoded strings.
5. **WebSocket events**: validate all incoming payloads with Zod safe-parse.
   Patch TanStack Query cache for updates, invalidate for new data.
6. **i18n**: 3 locales (en, fr, ar). Arabic is RTL — test layout in both
   directions. Translation keys under `messages/{locale}.json`. Currency: TND
   (Tunisian Dinar).
7. **API service pattern**: thin wrappers around
   `apiClient.get/post/patch/delete`. Response envelope is
   `{ status, message, data, meta }` — extract `response.data.data` for the
   payload.
8. **Token refresh**: handled by AuthProvider (proactive 13min interval +
   reactive 401 interceptor). `performRefreshOnce()` mutex prevents concurrent
   refresh calls. Never add separate refresh logic.
9. **Fonts**: Quicksand (`font-sans`) + Comfortaa (`font-heading`), both with
   Noto Sans Arabic in the stack so Arabic resolves per character with no locale
   conditional. Loaded via `next/font/google` in `app/[locale]/layout.tsx`. See
   `DESIGN.md` §3.1.
10. **Guards show loading state**: AuthGuard and RoleGuard render skeletons
    while `isLoading=true`. Never render protected content before auth state
    resolves.
11. **i18n namespace registration**: Each route group layout (`(merchant)`,
    `(admin)`) uses `pickMessages()` with an explicit namespace list. When
    adding a new translation namespace to `messages/*.json`, you **must** also
    add it to the relevant layout's `*_NAMESPACES` array — otherwise keys render
    as raw `namespace.key` strings on the client.
12. **User-facing errors**: Never expose technical error messages (status codes,
    stack traces, raw exception names) to users. Catch API errors and display a
    translated, human-friendly message. Use the backend's
    `response.data.message` when it's user-appropriate, otherwise use a generic
    fallback from translations.
13. **Parallel translation updates**: When adding or modifying translation keys,
    update **all 3 locale files** (`en.json`, `fr.json`, `ar.json`) in the same
    commit. Never add a key to one locale without adding it to the others.
14. **Dialog over inline for complex UI**: Multi-step or multi-option flows
    (plan selection, payment, confirmations) should use a `<Dialog>` modal, not
    inline expansion. The trigger (button) stays in the page; the flow lives in
    the modal.

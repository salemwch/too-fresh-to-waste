---
paths:
  - 'apps/web/**/*.ts'
  - 'apps/web/**/*.tsx'
---

# Web Coding Rules

Rules specific to `apps/web`. Architecture is documented in project CLAUDE.md — these are coding-level decisions only.

1. **No tokens in JavaScript** — auth uses HttpOnly cookies set by backend. Never store tokens in localStorage, sessionStorage, or Zustand. Use `withCredentials: true` on all API calls.
2. **Routing**: always use next-intl's `useRouter()`, `Link`, `usePathname()` from `@/i18n/routing` — they handle locale prefix automatically. Never use `next/link` or `next/navigation` directly.
3. **Route protection**: server-side via middleware (Edge JWT verification) + client-side via `<AuthGuard>` and `<RoleGuard>` in layout files. Both layers are required.
4. **Query keys**: use centralized factory (`dashboardKeys`) for all TanStack Query keys. Invalidate via factory, not hardcoded strings.
5. **WebSocket events**: validate all incoming payloads with Zod safe-parse. Patch TanStack Query cache for updates, invalidate for new data.
6. **i18n**: 3 locales (en, fr, ar). Arabic is RTL — test layout in both directions. Translation keys under `messages/{locale}.json`. Currency: TND (Tunisian Dinar).
7. **API service pattern**: thin wrappers around `apiClient.get/post/patch/delete`. Response envelope is `{ status, message, data, meta }` — extract `response.data.data` for the payload.
8. **Token refresh**: handled by AuthProvider (proactive 13min interval + reactive 401 interceptor). `performRefreshOnce()` mutex prevents concurrent refresh calls. Never add separate refresh logic.
9. **Fonts**: Inter (Latin) + Noto Sans Arabic. Selected by locale direction in root layout.
10. **Guards show loading state**: AuthGuard and RoleGuard render skeletons while `isLoading=true`. Never render protected content before auth state resolves.

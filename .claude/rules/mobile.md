---
paths:
  - 'apps/mobile/**/*.ts'
  - 'apps/mobile/**/*.tsx'
---

# Mobile Coding Rules

Rules specific to `apps/mobile`. Architecture is documented in project CLAUDE.md — these are coding-level decisions only.

1. **Tokens in Keychain ONLY** — never Redux, MMKV, or AsyncStorage. MMKV is for UI cache only.
2. **No AbortController** on fire-and-forget POST hooks — cleanup aborts the in-flight request.
3. **Navigate to OrderDetails** via `CommonActions.reset` with nested OrdersStack state — it is NOT in MainStack.
4. **Skeleton loading**: `Animated` + `LinearGradient` shimmer pattern (see `SkeletonOfferCard` for reference).
5. **`establishmentId`** in Order can be string OR populated object — always use helper functions, never access `.name` directly.
6. **Profile image**: resolve `profileImage > avatar > null`. After upload persist to Keychain, not Redux-only.
7. **`exactOptionalPropertyTypes`**: use conditional spread `...(val ? { key: val } : {})` instead of `val | undefined`.
8. **pnpm hoisted mode**: `node_modules/` lives at monorepo root. Gradle `ext.nodeModulesDir` points there.
9. **New Arch**: every autolinked native module needs `codegenConfig` in its `package.json` — modules without it cause CMake errors.

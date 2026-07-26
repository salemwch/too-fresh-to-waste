# Performance Standards

Speed and smoothness are a **product requirement**, not an optimisation pass.
Every change is a performance decision. A refactor that costs renders is a
regression, however much cleaner it reads.

---

## Non-Negotiables

1. **No new allocations in render.** `?? []`, `?? {}`, inline object/array
   literals and inline arrow props all create a new identity every render, which
   invalidates every `useMemo`/`React.memo` downstream. Use a frozen
   module-level constant — see `NO_OFFERS` in
   `features/search/utils/groupOffers.ts`.
2. **Stable callback identity into memoised children.** A `React.memo` component
   whose handler is recreated each render is not memoised. `useCallback` the
   handler, or the memo is decoration.
3. **One request per thing.** Dedupe through the React Query key. If two paths
   fetch the same data, seed the cache from the one that already ran rather than
   letting both fire — see `syncCurrentUserAsync` seeding `['auth','me']`.
4. **`staleTime` on every query.** Without it, screen focus refires requests
   that return what you already have. Use the `Freshness` presets.
5. **Keep the module graph shallow.** A component that renders a name must not
   drag in toast, vector-icons and i18n. Prefer `apiClient` over service
   wrappers that pull error/toast chains into every consumer.
6. **Select only what you render.** Backend: `.select()` / `.lean()`. Client:
   React Query `select`. Never fetch a field to throw it away.
7. **No N+1.** Batch or populate in a single call.

---

## Lists

Long lists are where mobile jank shows first.

- `FlashList` for anything unbounded; `keyExtractor` always.
- Horizontal carousels: tune `windowSize`, `maxToRenderPerBatch`,
  `initialNumToRender`, and set `removeClippedSubviews`.
- Row components: `React.memo`, with a stable `renderItem` via `useCallback`.
- `contentContainerStyle` as a memoised object when it cannot come from a
  `StyleSheet` entry (FlashList types it as a single object).

---

## Animation

- Prefer `transform` over animating layout properties.
- Keep animation off the JS thread where the API allows it.
- Under edge-to-edge, never pass `translucent`/`backgroundColor` to `StatusBar`
  (no-ops that hit RN's deprecated path).

---

## Decomposition

When splitting a screen:

- The extracted child must not re-render more often than the code it replaced.
- Props must be stable — pass memoised callbacks and values, not fresh literals.
- Prefer moving _pure_ logic out first (mappers, geometry, grouping): zero
  render cost, and it makes the component work verifiable.

---

## Verification

There is no automated perf gate. Before reporting a UI change done, reason
explicitly about: what re-renders now that did not before, what allocates per
render, and how many requests the screen makes on mount and on focus.

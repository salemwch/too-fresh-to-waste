# Plan — remove the favorites Redux mirror

**Status:** proposed, not started
**Scope:** `apps/mobile` only. No backend or web changes.
**Prerequisite:** none. Independent of H5.

## Why

`favorites` is server state that currently lives in three places at once:

```
Backend  →  React Query  ['favorites', 'infinite']   server cache
         →  Redux        favoritesSlice.favoriteMap   mirror of the same data
         →  MMKV         redux-persist whitelist      persisted copy of the mirror
```

The tell is `favoritesSlice.lastSyncedAt` — a hand-rolled cache-invalidation
timestamp, which is what `staleTime` does for free. `isLoading` and `error` sit
beside it, duplicating state React Query already owns.

Per the ownership rule: **server data → React Query; client state → Redux; MMKV
is a persistence mechanism, never an owner.** By that rule `location` and
`auth.flowState` correctly belong in Redux. `favorites` does not.

---

## 1. Consumers of `favoritesSlice`

Exports: `syncAllFavorites` (thunk), `addFavoriteOptimistic`,
`removeFavoriteOptimistic`, `clearFavorites` (actions), `selectIsFavorite`
(memoized selector), `favoritesReducer` (default), `FavoritesState` (type).

| File | Uses | Notes |
|---|---|---|
| `App.tsx` | `syncAllFavorites`, `clearFavorites` | Dispatched on auth-state change; clears on logout |
| `features/favorites/hooks/useFavoriteToggle.ts` | `addFavoriteOptimistic`, `removeFavoriteOptimistic`, `selectIsFavorite` | The only writer. Whole migration turns on this file |
| `features/favorites/components/FavoriteOfferCard.tsx` | `selectIsFavorite` | Per-card subscription |
| `features/offers/screens/OfferDetailsScreen.tsx` | `selectIsFavorite` | Single read |
| `store/index.ts` | `favoritesReducer`, `FavoritesState`, persist whitelist | Registration + persistence |

Tests touching it: `FavoriteOfferCard.memo.test.tsx` (mocks `selectIsFavorite`).

Read-only consumers are just three call sites — the migration is small in
surface area and concentrated in `useFavoriteToggle`.

`useFavoritesInfinite` (`['favorites','infinite']`) already reads the same data
from React Query and does **not** touch Redux. That is the target shape.

## 2. Optimistic update requirements

Anything replacing the slice must preserve all five:

1. **Instant flip** — the heart fills before the request leaves. Currently a
   dispatch before `await`.
2. **Rollback on failure** — `previousState` is captured and restored.
3. **Concurrency guard** — an `isLoading` flag rejects a second toggle while one
   is in flight, so double-taps cannot invert the result.
4. **Offline enqueue** — when `offlineManager.isOffline()`, the toggle is written
   to `OfflineWriteQueue` (`FAVORITE_TOGGLE`) and a "will sync when online"
   toast is shown instead of calling the API.
5. **Offline durability** — ⚠️ **the binding constraint.** An optimistic
   favourite made offline must survive an app restart until the queue drains.
   That is *why* `favorites` is in the redux-persist whitelist today. React
   Query's `onMutate` patch is in-memory, so a naive port loses the heart state
   on relaunch while the queued write is still pending.

## 3. Migration path

**Step 1 — replace the read.** Add `useIsFavorite(offerId)` backed by a
`['favorites','ids']` query (the existing `favoritesService.getFavoriteIds()`),
with `select` narrowing to a boolean so each card re-renders only when *its own*
flag changes — matching what `createSelector` gives today. Point the three read
sites at it. Redux still writes; nothing breaks. **Rollback: revert one commit.**

**Step 2 — move the write to `useMutation`.**

```ts
useMutation({
  mutationFn: () => favoritesService.toggleFavorite(...),
  onMutate: async () => {
    await queryClient.cancelQueries({ queryKey: ['favorites'] });
    const previous = queryClient.getQueryData(['favorites', 'ids']);
    queryClient.setQueryData(['favorites', 'ids'], patch);   // req. 1
    return { previous };                                      // req. 2
  },
  onError: (_e, _v, ctx) => queryClient.setQueryData(['favorites','ids'], ctx.previous),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
});
```

`isPending` replaces the manual `isLoading` guard (req. 3). The offline branch
(req. 4) stays as-is — it is orthogonal to where state lives.

**Step 3 — solve durability (req. 5) before deleting anything.** Add
`'favorites'` to `PERSISTABLE_KEY_PREFIXES` in `lib/react-query/persister.ts`.
Two things must be checked, not assumed:
  - the persisted-cache `maxAge` is **1 hour** (`PERSISTED_CACHE_MAX_AGE`), far
    shorter than redux-persist's indefinite retention. A favourite queued
    offline for longer than an hour would lose its optimistic flag while the
    queued write survives. Either lengthen the age for this key or have the
    write queue re-apply its pending items to the cache on startup — **the
    latter is correct**, since the queue is the durable record of intent.
  - favourites are user-scoped, and the query cache is not currently cleared on
    logout. `clearFavorites` does that today.

**Step 4 — delete.** Remove the slice, drop `favorites` from the persist
whitelist and the reducer registration, delete `FavoritesState`, and replace
`syncAllFavorites`/`clearFavorites` in `App.tsx` with a query invalidation and a
`queryClient.removeQueries({ queryKey: ['favorites'] })` on logout.

Steps 1–2 are independently shippable and revertable. Step 4 is the only
irreversible one and must not land until Step 3 is verified on a real device.

## 4. redux-persist cleanup

- `store/index.ts`: `whitelist: ['auth', 'favorites', 'location']` → drop
  `favorites`; remove `favoritesReducer` from `rootReducer`.
- **Migration for existing installs:** persisted state on upgraded devices will
  still contain a `favorites` key. redux-persist ignores unknown keys, so it is
  inert — but it should be purged via a persist `migrate` step so stale
  favourite data is not carried indefinitely in encrypted storage.
- No MMKV store changes. `redux-persist-storage` keeps its id; the query cache
  already lives in the separate disposable `cache` store.

## 5. Regression risks

| Risk | Severity | Mitigation |
|---|---|---|
| Offline favourite loses its heart after restart while the queued write is pending | **High** | Step 3 — re-apply pending queue items to the cache on startup. Test: toggle offline → force-quit → relaunch → heart still filled → go online → persists |
| Favourites leak across accounts on logout/login | **High** | `removeQueries` on logout; test account A → logout → account B |
| Per-card re-render storm — a naive `useQuery` in each card re-renders every card when one toggles | Medium | `select` to a boolean; verify with the existing render-count test in `FavoriteOfferCard.memo.test.tsx` |
| `syncAllFavorites`' auth-readiness guard is lost | Medium | It rejects rather than fulfils specifically so an unauthenticated sync cannot overwrite the persisted map with `{}`. The React Query equivalent is `enabled: isAuthReadyForApiCalls(...)` — must be carried over deliberately, not dropped |
| Double-tap inverts state | Low | `isPending` guard, same as today |
| Optimistic flag survives a failed request | Low | `onError` rollback, covered by test |

## 6. Verification

Per step: `tsc`, `eslint`, full jest suite. Plus new tests for the
offline-restart path (currently untested in any form) and the account-switch
path. Manual device check for Step 3 — the durability behaviour cannot be
proven in jsdom.

## 7. Recommendation

Worth doing: the duplication is real and `lastSyncedAt` is a maintenance
liability. But **Step 3 is the whole job.** The read/write migration is routine;
the offline-durability contract is the part that currently works by accident of
`favorites` being in the redux-persist whitelist, and it needs an explicit
design before the slice is deleted.

Suggested sequencing: Steps 1–2 in one PR (safe, revertable, no behaviour
change), Step 3 in its own PR with device testing, Step 4 last.

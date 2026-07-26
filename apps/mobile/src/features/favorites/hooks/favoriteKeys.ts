/**
 * Query key factory for favorites.
 *
 * Centralised so invalidation cannot drift from the keys it is meant to hit —
 * the same convention the web app uses for `dashboardKeys`. Call sites were
 * previously writing `['favorites', 'infinite', filters]` and
 * `invalidateQueries({ queryKey: ['favorites'] })` as literals in different
 * files, which works only for as long as nobody typos one of them.
 *
 * The hierarchy is deliberate: every key starts with `all`, so invalidating
 * `favoriteKeys.all` invalidates the id set and every filtered list at once.
 */

export const favoriteKeys = {
  /** Root — invalidate this to refresh everything favorites-related. */
  all: ['favorites'] as const,

  /**
   * The full set of favorited item ids.
   *
   * Deliberately a flat id set rather than the paginated list: it is what
   * "is this offer favorited?" needs, it is small enough to hold entirely, and
   * one query serving every card beats one query per card.
   */
  ids: () => [...favoriteKeys.all, 'ids'] as const,

  /** Paginated favorites list, per filter combination. */
  infinite: (filters: unknown) => [...favoriteKeys.all, 'infinite', filters] as const,
} as const;

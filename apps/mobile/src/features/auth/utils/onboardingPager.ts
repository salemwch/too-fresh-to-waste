/**
 * Geometry for the onboarding pager, as pure functions.
 *
 * Two things make this worth extracting rather than inlining into the scroll
 * handler:
 *
 * 1. **RTL.** A horizontal ScrollView is mirrored by the platform when the app
 *    is laid out right-to-left, so the page sitting at `contentOffset.x === 0`
 *    is the LAST page, not the first. Every conversion between a scroll offset
 *    and a page number has to agree about that, and there are four call sites.
 * 2. **Degenerate widths.** `useWindowDimensions()` can hand back 0 on the
 *    first frame, and `0 / 0` is `NaN` — which sails through `Math.round` and
 *    ends up as a `NaN` page index driving the dots and the arrow buttons.
 */

/** Pages in the onboarding flow. The dots and the arrows both read this. */
export const ONBOARDING_PAGE_COUNT = 3;

/** Keeps a page number inside the flow, whatever arithmetic produced it. */
export function clampPageIndex(index: number, pageCount: number): number {
  if (!Number.isFinite(index)) return 0;
  if (pageCount <= 0) return 0;
  return Math.min(Math.max(Math.round(index), 0), pageCount - 1);
}

/**
 * Logical page number (0 = the first page the user sees) for a scroll offset.
 *
 * `rtl` mirrors the result: in Arabic the platform reverses the scroll axis, so
 * offset 0 is the last page.
 */
export function pageIndexFromOffset(
  offsetX: number,
  pageWidth: number,
  pageCount: number,
  rtl: boolean,
): number {
  // Guards the NaN described above, plus the overscroll bounce at either end,
  // which reports offsets outside [0, (count - 1) * width].
  if (!Number.isFinite(offsetX) || !Number.isFinite(pageWidth) || pageWidth <= 0) return 0;

  const visual = clampPageIndex(offsetX / pageWidth, pageCount);
  return rtl ? pageCount - 1 - visual : visual;
}

/**
 * Scroll offset that brings a logical page into view. The inverse of
 * `pageIndexFromOffset` — `offsetForPage(pageIndexFromOffset(x)) === x` for any
 * x that sits exactly on a page boundary.
 */
export function offsetForPage(
  index: number,
  pageWidth: number,
  pageCount: number,
  rtl: boolean,
): number {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) return 0;

  const logical = clampPageIndex(index, pageCount);
  const visual = rtl ? pageCount - 1 - logical : logical;
  return visual * pageWidth;
}

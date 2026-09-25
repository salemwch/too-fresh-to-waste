---
status: in-review
scope: mobile
gate:
  pnpm --filter @foodwaste/mobile type-check && pnpm --filter @foodwaste/mobile
  test
---

## Intent

Remove the hardcoded English the ratchet in
`src/i18n/__tests__/hardcodedStrings.test.ts` tracked (92 strings, 33 files),
plus the strings the detector could not see, so fr and ar users read their own
language. Harden the detector so the fix holds.

## Constraints

- Keys added to en / fr / ar in the same change (registration chain).
- No em dash in any new copy.
- Charity/donation logic untouched: owner asked to handle it last, alone.
  `DonationImpactScreen` got copy-only changes; `CharityDonationBottomSheet`
  long-form copy was left as is.

## Tasks & Acceptance

- [x] Every BACKLOG file translated except the unreachable placeholder
- [x] Detector sees five shapes, each pinned by a fixture; mutation-checked
- [x] Validation messages (yup) translated via `createXSchema(t)` factories
- [x] Full mobile suite green: 150 suites, 2550 tests, 430 snapshots
- [ ] Native-reader review of the new fr and ar copy before release
- [ ] APK rebuild: `Ionicons.ttf` subset regenerated (adds logo-facebook,
      logo-apple)

## Decisions

- 2026-09-24: yup schemas became factories taking `t`, memoised per screen.
  Rejected "keys as messages, translate at render": it cannot interpolate the
  policy minimums without a second encoding.
- 2026-09-24: mobile password rules now come from `@foodwaste/shared`
  (`PASSWORD_MIN_LENGTH`, `PASSWORD_SPECIAL_CHARS`). The old local rules
  accepted `#`, spaces and accents, which the backend's `buildPasswordRegex()`
  rejects.
- 2026-09-24: SecurityScreen (change password) now requires the shared 12,
  not 8. The reset flow already required 12, so one account had two rules.
- 2026-09-24: name pattern widened to Latin-with-accents + Arabic ranges. The
  backend accepts any 2-50 chars; the old `[a-zA-Z]` rejected real names.
- 2026-09-24: SecurityScreen names the real provider (Google / Facebook / Apple)
  instead of always "Google".
- 2026-09-24: the review comment is composed in the reviewer's language and
  follows the rating; it no longer says "Really enjoyed" on a 1-star review.

## Open questions

- Non-blocking: delete `EstablishmentDetailsScreen` and `OrderHistoryScreen`?
  Both are registered in `MainStack` but nothing navigates to them and no deep
  link targets them. EstablishmentDetails is a placeholder and stays on the
  backlog (4) until decided.
- Non-blocking: backend `users/DTO/update-password.dto.ts` still accepts 8
  characters while register/reset use `PASSWORD_MIN_LENGTH` (12).
- Non-blocking: `DonationImpactScreen` shows "Loading" forever when the stats
  query fails (no error state). Left for the charity pass.

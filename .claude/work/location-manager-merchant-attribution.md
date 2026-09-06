---
status: ready-for-dev
scope: backend
gate: pnpm --filter @foodwaste/backend check:all
---

## Intent

Every `LOCATION_MANAGER` on the platform currently reads **zero** for their
entire sustainability dashboard - ESG tier, monthly goal, carbon metrics, social
impact, and the carbon-balance PDF - for an establishment with real trading
history. This is live today. Fix the attribution so a location manager sees
their assigned establishment's real figures.

Found on 2026-09-06 by the whole-branch review of `feat/merchant-fund-ledger`,
and confirmed independently by the fix-wave re-review. That branch fixed the
same bug for the fund ledger only, because the ledger was the only handler in
its scope.

## The bug

`order.service.ts:447` sets `order.merchantId = establishment.ownerId`. Every
sustainability aggregation keys on that value:

```ts
$match: {
  merchantId: new Types.ObjectId(merchantId);
}
```

but the controller passes `req.user.userId`. For a `MERCHANT` those are the same
id, so the happy path works and the bug is invisible. For a `LOCATION_MANAGER`
they are different ids, so the `$match` returns **zero rows, always**.

It fails closed - no data leak, no error - which is exactly why nothing caught
it. The UI renders a legitimate-looking empty state.

## Affected sites

All in `sustainability.service.ts`, reached through
`sustainability.controller.ts`:

| Handler                       | Service method              | What the manager sees today |
| ----------------------------- | --------------------------- | --------------------------- |
| `getEsgTier`                  | `getAllTimeBagsSaved` (:50) | Apprenti, 0 bags            |
| `getMonthlyGoal`              | `getMonthlyGoal` (:136)     | 0 progress                  |
| `updateMonthlyGoal`           | `updateMonthlyGoal` (:192)  | writes against the wrong id |
| `getCarbonMetrics`            | `getCarbonMetrics` (:209)   | all zeros                   |
| `getSocialImpact`             | `getSocialImpact` (:262)    | all zeros                   |
| `downloadCarbonBalanceReport` | calls four of the above     | a PDF of zeros              |

`getFundLedger` is **already fixed** on `feat/merchant-fund-ledger` and is the
reference implementation.

## The fix, already proven

`FundLedgerService.resolveEstablishmentOwnerId(establishmentId)` and the
`LOCATION_MANAGER` branch in `sustainability.controller.ts` are the pattern.
Resolve the assigned establishment's `ownerId`, read as that merchant, keep the
query scoped to the assigned establishment, and refuse with `NotFoundException`
and user-facing copy when the establishment does not resolve.

Do not fall back to the caller's own id (reproduces the false empty state) and
do not drop the establishment scope (exposes the whole organisation).

`resolveEstablishmentOwnerId` should move somewhere both services can use it
rather than being duplicated - it currently lives on `FundLedgerService`.

## Tasks & Acceptance

- [ ] Extract the owner-resolution + refuse-rather-than-widen branch into one
      shared helper - acceptance: `getFundLedger` and the five handlers above
      call the same code, with no second copy of the rule
- [ ] Apply it to all six sites
- [ ] Controller spec per handler asserting the resolved **owner** id reaches
      the service and the manager's own id does not - the fund ledger's
      `sustainability-fund-ledger.controller.spec.ts` is the model
- [ ] `updateMonthlyGoal` needs its write path checked too, not just the read -
      a goal written against the wrong id is a data defect, not a display one
- [ ] Confirm with a real location-manager account that the dashboard shows
      non-zero figures

## Decisions

- **2026-09-06** - Filed as its own work item rather than widened into
  `feat/merchant-fund-ledger`. That branch was scoped to the ledger slice, the
  five sibling handlers are untouched by its diff, and a fix wave is not the
  place to take on six more call sites. Recorded here so the scoping decision
  does not become a silent omission.

## Open questions

- Does any location manager currently rely on the zeros being zero - a dashboard
  that suddenly shows real figures is correct, but worth one line in a release
  note.

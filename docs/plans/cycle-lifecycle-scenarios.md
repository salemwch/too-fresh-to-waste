# Cycle Lifecycle — Every Scenario

What happens today, what should happen, and what has to be decided before it can
be built. Grounded in the code as of 2026-07-27, not in intent.

---

## 1. There are two community goals, not one

This is the finding that everything else follows from. Two independent models
both track "bags saved toward the community target", and an order increments
**both**, in two separate try/catch blocks
(`loyalty/listeners/order-events.listener.ts`):

|                        | `CommunityBagGoal`                                         | `VotingCycle`                          |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------- |
| Counter                | `currentCount`                                             | `communityGoalProgress`                |
| Target                 | `targetCount` (default 8000)                               | `communityGoalTarget`                  |
| Deadline               | `endDate`                                                  | `cycleEndDate`                         |
| Cycle number           | `cycleNumber`                                              | `cycleNumber` (separate sequence)      |
| **Deadline enforced?** | **No — display only**                                      | **Yes — `voting.cron.ts` every 5 min** |
| On target reached      | Completes, pays points, opens next cycle, carries overflow | Opens ballot, snapshots eligibility    |
| On deadline passed     | **Nothing**                                                | `EXPIRED`                              |

Each increment is independently fault-tolerant — either can fail and be logged
while the other succeeds. Nothing reconciles them afterwards, so the two numbers
drift apart permanently on any failure.

**They can already disagree today**, and the app shows `CommunityBagGoal` while
voting eligibility is decided by `VotingCycle`.

---

## 2. Your question, answered — what the code does _today_

> This section is current state, not the target. What it _should_ do is §4.

> What happens if the cycle doesn't reach 30,000 bags?

**Two different things, because of the split above.**

- The **voting cycle** expires. `voting.cron.ts` sees `now >= cycleEndDate`,
  calls `expireCycle()`, status becomes `EXPIRED`. No ballot, no prizes. This
  path works.
- The **community bag goal** does nothing at all. `endDate` is never compared to
  `now` anywhere in the backend. The goal stays `ACTIVE` forever, the counter
  keeps rising, and the "Ends 12 Jan" line in the app becomes false.

> Do we reset every 6 months?

No. `CommunityBagGoal` resets on exactly two triggers: the target being reached,
or an admin calling `resetGoal()` by hand. Time is not one of them.

> Do we reset points, leaderboard, merchant?

No, none of them. There is no points reset anywhere in the codebase. The
leaderboard ranks on `LoyaltyAccount.totalPoints`, which is lifetime and never
zeroed.

> Keep water and CO2?

Those are already separate from points, so that part needs no work.

---

## 3. Scenarios

### A. The happy path

**Target reached before the deadline.** Today: voting ballot opens, eligibility
snapshots are written, bag goal completes and pays `rewardPoints` to
`participantIds`, overflow carries into cycle N+1. Gap: the two cycles advance
independently. `CommunityBagGoal.cycleNumber` and `VotingCycle.cycleNumber` are
separate sequences that were never guaranteed to match.

### B. Deadline passes, target not reached ← the question

Today: voting expires; bag goal continues as if nothing happened. **Decided**
(§4.2): the season closes as a failure — no community bonus, no smartphone, no
vote — but the personal discount voucher is still issued, and season N+1 starts
at 0.

### C. Target reached in the same tick the deadline passes

Today `voting.cron` checks expiry **first**, so the cycle expires even though
the goal was met — a race decided by a 5-minute poll. **§4.1 dissolves this**:
under a fixed season, reaching the target never ends anything, so there is no
competing transition. Only `endDate` closes a season, and the target is read
once at that moment. Keep it that way; do not reintroduce a target-triggered
transition.

### D. Target reached, then more bags arrive before the reset lands

Today: overflow carries into the next cycle. **§4.1 removes this** — the season
does not end at the target, so bags past 30,000 simply keep counting until
`endDate` and the season closes with, say, 34,000/30,000. Nothing carries over.
The existing carry-over code becomes dead and should be deleted rather than left
armed for a transition that can no longer fire.

### E. Deadline passes while a ballot is open

Not possible today: expiry only applies to `ACTIVE`, and an open ballot is
`BALLOT_OPEN`. Worth stating so nobody "fixes" it later.

### F. User earns their 25th bag one minute before the deadline

Eligibility is snapshotted **when the ballot opens**
(`createEligibilitySnapshots`), not continuously. Bags after that instant do not
count. Needs deciding: is the eligibility cut-off the deadline, or the moment
the ballot opens? They are not the same instant.

### G. Snapshot creation fails

Handled — `retryFailedSnapshots` retries every 5 minutes while
`snapshotReady: false`. Good.

### H. A cycle ends with prize claims still pending

`PrizeClaim` records `totalPoints` at claim time, and the reset zeroes the live
balance, so the two permanently disagree. **Decided**: claims freeze. The
snapshot on the claim is the record of what was earned — see scenario U.

### I. Points reset while a user holds unspent `availablePoints`

**Decided** (§4.3): points are converted to the discount voucher **before** the
reset runs, so nothing is confiscated. The failure mode to design against is a
rollover that resets before converting, or that converts twice — the conversion
and the reset must be one operation, and it must be idempotent because the cron
can retry.

Still needs: an in-app warning before season end so the user knows the score is
about to clear, and the conversion rate itself (§4.4).

### J. Merchant "reset"

`MerchantGoal` is `targetBagsPerMonth` — **monthly**, not aligned to a 6-month
consumer season at all. There is nothing to reset in step; the two run on
different clocks by construction. Open — see §4.4.

### K. Admin resets by hand mid-cycle

`resetGoal()` zeroes `currentCount` and stamps `resetAt`, but does **not** touch
`VotingCycle.communityGoalProgress`. After a manual reset the two counters are
guaranteed to disagree.

### L. Admin edits `targetCount` mid-cycle

`setGoalTarget` allows it. Lowering it below `currentCount` completes the cycle
immediately on the next increment; raising it moves the goalposts for people who
already earned toward it. Needs deciding: allow only between cycles, or allow
with an audit entry.

### M. The app is offline when a cycle rolls over

Mobile caches goal stats. A user could see the old cycle's numbers, and their
points, after both have been reset server-side. Needs: the rollover event must
invalidate the relevant query keys, not only broadcast over WebSocket to whoever
is connected.

### N. A cycle rolls over while a user is mid-order

The order completes and increments a counter belonging to the **new** cycle,
while the user believes they were contributing to the old one. Needs deciding:
attribute by order creation time or completion time.

### O. Two app servers run the cron simultaneously

`completeAndResetGoal` uses a conditional `findOneAndUpdate` on
`status: ACTIVE`, so only one writer wins — correct. `expireCycle` does the
same. Any new reset job must follow that pattern.

### P. Nobody participates at all

`participantIds` is empty, `rewardPoints` distribution is skipped, cycle
completes or expires with nothing to pay. Safe today.

### Q. A season ends short and users open the prize screen

**Today the prizes are handed out anyway.** `getEndedGoal()` selects on
`endDate: { $lte: new Date() }` alone — `currentCount` versus `targetCount` is
never consulted. So `claimSmartphone` succeeds for the top 5 of a season that
missed its target. Per §4.2 the discount is correct to pay; the smartphone and
the community bonus are not. Both claim paths need a "target reached" guard.

### R. Ranking cost at 5,000 users — **fixed**

`getUserRank` ran `find({ isActive: true })` with no limit, sorted every loyalty
account, pulled them all into memory and called `findIndex` — on every
`getClaimStatus`, i.e. every prize-screen open, by every user, at the exact
moment traffic spikes at season end. Now one `findOne` plus a `countDocuments`
of the accounts ahead, covered by a new compound index.

Fixing it surfaced a worse defect underneath. **Prize ranking and leaderboard
ranking used different predicates.** The leaderboard filters on
`{ isActive, 'leaderboardConsent.given' }`; the prize ranking filtered on
`isActive` alone. A user who had opted out of the leaderboard was invisible on
it but still occupied a prize rank, pushing everyone below them down one — the
top-5 smartphone boundary included. The rank a prize was awarded on was not the
rank the user was shown.

The predicate now lives in one place,
`loyalty/constants/leaderboard-ranking.ts`, used by `loyalty.service`,
`leaderboard-cache.service` and `prize-claim.service`.

**Behaviour change to be aware of:** opting out of the leaderboard now opts you
out of the prize ranking too, so a non-consenting user has no rank and cannot
claim. That is the only self-consistent reading — you cannot win a leaderboard
prize while absent from the leaderboard — but it is a change, not a bug fix.

Ties now break on `_id`, so ranks are deterministic. Previously ties sat in an
order MongoDB does not guarantee between calls, meaning `getClaimStatus` could
show rank 5 and the claim then be rejected at rank 6.

### S. Two claim requests arrive together — **fixed**

`ensureNoDuplicateClaim` reads, then writes, so two requests arriving together
both pass the read. The unique index on `{ userId, cycleNumber }` stopped the
double claim, but the E11000 was unhandled — the user saw a 500, the app
reporting that it broke when it had correctly refused a double claim. The write
now maps a duplicate key **on a `userId` index** onto the same 409 and the same
message as the pre-check. A `voucherCode` collision is deliberately not treated
as a duplicate claim.

### T. The chosen establishment leaves the platform

`claimDiscount` snapshots `establishmentName` on the claim, so the record
survives — good. But the voucher has no expiry and nothing checks the
establishment is still active at redemption time. A season-1 voucher against a
closed merchant is currently valid forever.

### U. The user claims, then the next season starts

Claims are keyed by `cycleNumber`, so a pending claim from season N is
unaffected by season N+1 opening. But `PrizeClaim.totalPoints` was captured at
claim time and the user's live balance is now 0 — an admin comparing the two
will find they disagree. That is correct behaviour, not a bug; it needs stating
in the admin UI so nobody "fixes" it.

---

## 4. Decisions — made 2026-07-27

### 4.1 The season is a fixed 6 months. The target is pass/fail at the end.

**Decided:** the season always runs its full 6 months. Hitting 30,000 in month 3
does **not** end it early, does **not** pay prizes early, and does **not** open
the next cycle. The season runs to `endDate`; the target is evaluated once,
then.

> Recorded as "option C" in the answer, but the explanation given — _"if we get
> the target in 3 months we don't recycle or give prize, we keep going until the
> 6 months ends, then we give the prizes"_ — is a fixed calendar season (option
> A). The explanation is what is implemented here, because it is unambiguous and
> because it is what the prize-claim code already assumes: `getEndedGoal()`
> gates on `endDate: { $lte: new Date() }` and never looks at `currentCount`.

Consequence: overflow past the target keeps accumulating for the rest of the
season rather than rolling into cycle N+1. The current carry-over behaviour in
`completeAndResetGoal` becomes unreachable and should be removed, not left
armed.

### 4.2 A failed season pays the discount, but nothing else.

Two payouts exist and they are **not** governed by the same rule. This is the
reconciliation of what looked like a contradiction between "no prizes if we
fail" and "everyone gets the discount even if we didn't reach the goal":

| Payout                                 | On target reached | On target missed  |
| -------------------------------------- | ----------------- | ----------------- |
| Community bonus (`rewardPoints`)       | paid              | **not paid**      |
| Smartphone, top 5 (`SMARTPHONE`)       | awarded           | **cancelled**     |
| Personal discount voucher (`DISCOUNT`) | awarded           | **still awarded** |

The community goal unlocks the _collective_ rewards. The discount voucher is the
_personal_ payout for the points you earned yourself, so it is unconditional —
the user picks the establishment and receives a `voucherCode`.

Shortfall does **not** carry over. Season N+1 starts at 0/30,000.

Voting is cancelled for a failed season, not deferred.

### 4.3 What survives the reset

| Field                  | Reset? | Note                                                |
| ---------------------- | ------ | --------------------------------------------------- |
| `totalPoints`          | reset  | the seasonal competition score                      |
| `availablePoints`      | reset  | converted to the discount voucher first — see below |
| `totalBagsSaved`       | reset  | seasonal; lifetime figure moves to the stats screen |
| `currentTier`          | reset  | back to Bronze; every season starts equal           |
| `lifetimePointsEarned` | keep   | the permanent record                                |
| `totalOrdersCount`     | keep   | account history                                     |
| Water / CO₂ impact     | keep   | already independent of points                       |

**Points are never confiscated — they are cashed out.** The order at season end
is: convert points to the discount voucher, _then_ reset. A user is paid for the
season before the season is cleared, which is what makes resetting `currentTier`
and `availablePoints` acceptable rather than punitive.

**Lifetime stats stay reachable.** Resetting `totalBagsSaved` requires a
lifetime-stats view the user can open on demand ("see my stats forever"), backed
by `lifetimePointsEarned`, `totalOrdersCount` and the impact figures. Without
that screen this reset is a data loss, not a season boundary.

Note that `Tier` carries a `multiplier` — resetting the tier resets the earn
rate too, so every season starts at 1×. That is intended, but it means the first
weeks of a season earn more slowly than the last weeks of the previous one.

### 4.4 Still open

- **The conversion rate.** Points → discount value is undefined. Today
  `claimDiscount` records `totalPoints` on the claim but the voucher carries no
  amount or percentage; an admin presumably reads the number and decides. If the
  discount is to be automatic, the rate has to be defined.
- **Voucher expiry.** `PrizeClaim` has no expiry field. A voucher from season 1
  is valid forever, and against a merchant who may have left the platform.
- **Merchant season.** `MerchantGoal` is `targetBagsPerMonth` — monthly by
  construction. Whether a 6-month merchant season exists at all is unanswered.

---

## 5. Implementation order

1. **Reconcile the two goals into one.** Everything else is unsafe while two
   counters can disagree. Either `VotingCycle` reads from `CommunityBagGoal`, or
   the bag goal becomes a projection of the voting cycle. One writer.
2. **Enforce `endDate` on the bag goal**, using the same conditional
   `findOneAndUpdate` guard the existing transitions use. Per §4.1 this is the
   only thing that ends a season — remove the reach-target-and-reset path and
   its overflow carry-over, which §4.1 makes unreachable.
3. **Gate the collective prizes on the target** (§4.2, scenario Q): smartphone
   and `rewardPoints` require `currentCount >= targetCount`; the discount does
   not.
4. **Archive the leaderboard before resetting**, or the season's result is lost
   with no record of who won. This archive is also what the lifetime-stats view
   in §4.3 reads.
5. **Season rollover as one atomic operation** — close season, archive
   leaderboard, convert points to vouchers, reset the §4.3 fields, open the next
   season. Partial completion is the failure mode to design against; the
   ordering matters because points must be cashed out before they are cleared.
6. **Build the lifetime-stats view** before shipping the reset. §4.3 is a data
   loss without it.
7. **Invalidate mobile caches** on rollover, not just broadcast.

Scenarios Q–T are independent of the season work. **R and S are done** (commit
below). Q depends on §4.2 and is folded into step 3; T is still open.

---

## 6. Already correct — do not disturb

- Conditional `findOneAndUpdate` on status transitions (race-safe).
- Overflow carry-over on target reached.
- Snapshot retry for failed eligibility runs.
- Impact figures (water, CO2) being independent of points.
- Both goal increments being non-blocking so a failure cannot break checkout.

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

## 2. Your question, answered

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

Today: voting expires; bag goal continues as if nothing happened. Needs deciding
— see §4.1.

### C. Target reached in the same tick the deadline passes

`voting.cron` checks expiry **first**, so the cycle expires even though the goal
was met. A race decided by a 5-minute poll. Should be: whichever condition was
true first wins, judged by timestamps rather than by poll order.

### D. Target reached, then more bags arrive before the reset lands

Today: overflow carries over — deliberate and correct. Should stay.

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

`PrizeClaim` records `totalPoints` at claim time. If points reset at the
boundary, the recorded figure and the user's balance permanently disagree. Needs
deciding: settle all pending claims before reset, or freeze them.

### I. Points reset while a user holds unspent `availablePoints`

If points buy anything, wiping them is confiscating something earned. Needs
deciding: grace window, conversion, or explicit "seasonal points expire" in the
terms — and an in-app warning before it happens.

### J. Merchant "reset"

`MerchantGoal` is `targetBagsPerMonth` — **monthly**, not aligned to a 6-month
consumer cycle at all. There is nothing to reset in step; the two run on
different clocks by construction. Needs deciding: does a merchant season exist,
and is it 1 month or 6?

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

---

## 4. Decisions needed before this can be built

These are product calls. Each changes the design.

### 4.1 What does a failed cycle mean?

- Do participants still receive `rewardPoints` for a cycle that fell short?
- Does the shortfall carry over the way overflow does, or does the next cycle
  start clean?
- Is the voting round cancelled, or deferred to the next cycle?

### 4.2 What survives a reset?

`LoyaltyAccount` holds six relevant fields. Proposed split, needs confirming:

| Field                  | Reset?     | Why                                      |
| ---------------------- | ---------- | ---------------------------------------- |
| `totalPoints`          | reset      | the seasonal competition score           |
| `availablePoints`      | **decide** | spendable — see scenario I               |
| `lifetimePointsEarned` | keep       | the permanent record                     |
| `totalBagsSaved`       | **decide** | drives the "bags saved" impact figure    |
| `totalOrdersCount`     | keep       | account history                          |
| `currentTier`          | **decide** | does Gold drop to Bronze every 6 months? |

`currentTier` is the sharpest one. Resetting it is a retention decision, not a
technical one.

### 4.3 Is the season 6 months, or "until the target is hit"?

Today's design says the latter — the bag goal has no deadline and carries
overflow indefinitely. Your description says the former. They are different
products, and the answer determines whether the deadline is a hard boundary or a
target date.

---

## 5. Implementation order, once decided

1. **Reconcile the two goals into one.** Everything else is unsafe while two
   counters can disagree. Either `VotingCycle` reads from `CommunityBagGoal`, or
   the bag goal becomes a projection of the voting cycle. One writer.
2. **Enforce the deadline** on whichever survives, using the same conditional
   `findOneAndUpdate` guard the existing transitions use.
3. **Season rollover as one atomic operation** — close cycle, archive
   leaderboard, reset the agreed fields, open the next cycle. Partial completion
   is the failure mode to design against.
4. **Archive the leaderboard before resetting**, or the season's result is lost
   with no record of who won.
5. **Invalidate mobile caches** on rollover, not just broadcast.

---

## 6. Already correct — do not disturb

- Conditional `findOneAndUpdate` on status transitions (race-safe).
- Overflow carry-over on target reached.
- Snapshot retry for failed eligibility runs.
- Impact figures (water, CO2) being independent of points.
- Both goal increments being non-blocking so a failure cannot break checkout.

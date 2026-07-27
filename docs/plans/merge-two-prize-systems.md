# The two community goals are two different features

**This document previously argued for merging them. That was wrong.** The
correction, and the real bug it exposed, are below.

Grounded in the live cluster as of 2026-07-27.

---

## 1. The correction

`communitybaggoals` and `votingcycles` both count bags, so they looked like
duplicates that had drifted apart. They are not. They are two separate mechanics
running at different scales:

|             | `communitybaggoals`                                                                  | `votingcycles`                                |
| ----------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| What it is  | the **recurring mini-goal**                                                          | the **6-month season**                        |
| Target      | 500 bags                                                                             | 30,000 bags                                   |
| On reaching | pays `rewardPoints` (300) to every participant, carries overflow, opens the next 500 | opens the ballot, then the grand prize        |
| Reward      | points                                                                               | the voted prize — scooter, phone, hotel stay… |
| Cadence     | repeats continuously                                                                 | once per season                               |

141/500 and 30,001/30,000 were never supposed to match. One is progress toward
the next points bonus; the other is progress toward the season's grand prize.
Both numbers are correct.

**So the double increment in `order-events.listener.ts` is correct too.** One
order legitimately advances both counters. Nothing here needs merging.

### Why it read as a duplicate

Both fields are named for the same idea — `currentCount` vs
`communityGoalProgress`, `targetCount` vs `communityGoalTarget` — and both
models carry `cycleNumber`, `status` and an end date. Nothing in either name
says "mini-goal" or "season", so the two are indistinguishable from the schema
alone. That is worth fixing (§4) precisely because it misled a reader into
proposing to delete a working feature.

---

## 2. The real bug this exposed

**Grand-prize claiming is gated on the mini-goal.**

`prize-claim.service.ts` injects `CommunityBagGoal` — the 500-bag mini-goal —
and uses it to answer two season-level questions:

```ts
// "has the season ended?"  → actually asks the mini-goal's endDate
findOne({ endDate: { $lte: new Date() } }).sort({ cycleNumber: -1 });

// "did the community hit its goal?" → actually 141 >= 500
goal.currentCount >= goal.targetCount;
```

Neither is the season. The season is the `VotingCycle`, where the 30,000 target
and the real result live.

Consequences today:

- The grand prize unlocks when the community saves **500** bags, not 30,000.
- `cycleNumber` on every `PrizeClaim` is the **mini-goal's** cycle number, so
  claims are filed against the wrong season.
- The `targetReached` flag the app uses to decide whether to promise a phone
  reports the mini-goal's progress.

This was introduced by taking `CommunityBagGoal` to be the season. It is not.

---

## 3. The fix

`PrizeClaimService` reads the **season** — `VotingCycle` — for every
season-level question:

| Question              | Before                                  | After                                                          |
| --------------------- | --------------------------------------- | -------------------------------------------------------------- |
| Has the season ended? | `CommunityBagGoal.endDate`              | `VotingCycle.cycleEndDate`                                     |
| Was the target met?   | `currentCount >= targetCount` (141/500) | `communityGoalProgress >= communityGoalTarget` (30,001/30,000) |
| Which season is this? | mini-goal `cycleNumber`                 | voting `cycleNumber`                                           |

`CommunityBagGoal` keeps doing exactly what it does now — count to 500, pay
points, reset — and the home banner keeps rendering it unchanged.

Neither UI changes. The home banner still shows the mini-goal; the profile
voting card still shows the season.

---

## 4. Rename, so this cannot happen again

The confusion was caused by the naming, and the naming is still there. Worth
doing as a follow-up:

- `CommunityBagGoal` → `MonthlyBagGoal` (or `BagGoalRound`), and its collection
  with a migration.
- On `VotingCycle`, `communityGoalProgress` / `communityGoalTarget` →
  `seasonBagProgress` / `seasonBagTarget`.

Until then, every file touching either needs a comment saying which one it is.

---

## 5. Scenarios

### A. An order completes

Both counters increment, correctly and independently. The two try/catch blocks
stay — a failure in one must not roll back the other, because they are tracking
different things.

### B. The mini-goal hits 500

Points are paid, overflow carries, the next 500-round opens. The season is
untouched. No prize is unlocked.

### C. The season hits 30,000

The ballot opens (`voting.cron.ts`). The mini-goal keeps counting to its own 500
independently.

### D. Season ends short of 30,000

Per `cycle-lifecycle-scenarios.md` §4.2: no grand prize, no community bonus,
everyone still claims their discount. The mini-goal is unaffected and keeps
running — a failed season does not stop the points bonus.

### E. Mini-goal and season end near each other

No interaction. They are separate records with separate transitions, and after
§3 nothing reads one to answer a question about the other.

### F. No voting cycle exists

There is no season, so there is no grand prize to claim. `getClaimStatus` must
report "nothing to claim" rather than falling back to the mini-goal — which is
exactly the bug in §2.

### G. Existing prize claims

Claims already written carry a mini-goal `cycleNumber`. There are **0
documents** in `prizeclaims`, so no migration is needed. Worth re-checking
before deploying.

---

## 6. Already correct — do not disturb

- Both counters, and both increments in the order listener.
- `CommunityBagGoal`'s complete-pay-reset loop, its overflow carry-over and its
  atomic `$inc`.
- Both UI components.

# Merging the two prize systems

Both screens keep their design. Only the numbers behind them merge.

Grounded in the live cluster as of 2026-07-27, not in intent.

---

## 1. What the split looks like today

Two collections both claim to be "the community goal", and they disagree:

|                | `communitybaggoals`  | `votingcycles`           |
| -------------- | -------------------- | ------------------------ |
| Records        | 1                    | 3                        |
| Target         | **500**              | **30,000**               |
| Progress       | **141**              | **30,001** (Q2)          |
| Season ends    | 11 Dec 2026          | 22 Dec / 23 Dec / 25 Jul |
| Cycle 1 status | `active`             | `ARCHIVED`               |
| Winners        | 3 (`PHONE_MAX_RANK`) | 5 (`recipientCount`)     |

They drifted because an order increments **both**, in two adjacent try/catch
blocks in `loyalty/listeners/order-events.listener.ts:153` and `:162`. Either
can fail while the other succeeds, and nothing reconciles them afterwards.

**The user-visible consequence, right now:** the leaderboard asks the bag goal,
sees `endDate` 11 Dec has not passed, and says "no challenge has ended". The
voting card asks the voting cycle, finds Q2 `COMPLETED` with
`winner: Electric Scooter`, and says "you won — claim it". Same user, same
second, two contradictory answers.

---

## 2. What is being kept

Both UIs stay exactly as they are:

- **Home** — `CommunityBagGoalBanner`, the progress bar toward the community
  target, plus the cause/donation copy.
- **Profile** — `VotingCard` inside `LoyaltyScreen`: the ballot, the prize
  catalogue, the winner announcement, the claim CTA.

Neither component changes. They keep their titles, their layout, their copy.

---

## 3. The merge: one writer, two views

`CommunityBagGoal` stays the **writer**. `VotingCycle` becomes a **reader** of
it.

That direction rather than the reverse, because the bag goal already owns three
things the voting cycle has no equivalent for:

- `participantIds` — who took part, which decides who is paid `rewardPoints`
- `rewardPoints` — the community bonus itself
- `causeType` / `causeTitle` / `causeDescription` — the donation copy the home
  banner renders

Reversing it would mean rebuilding all three on the voting cycle. Reading the
count from the bag goal costs one query.

It also means the home banner — the most-viewed screen in the app — needs **zero
changes**, because its service and its response shape are untouched.

### The single counter

```
order completes
      │
      └──► CommunityBagGoal.currentCount++        ← the only writer
                    │
                    ├──► home banner reads it (unchanged)
                    └──► VotingCycle reports it as communityGoalProgress
```

`VotingCycle.communityGoalProgress` stops being written and becomes derived.
`VotingCycle.communityGoalTarget` likewise defers to
`CommunityBagGoal.targetCount`, so "30,000" has one definition instead of two.

---

## 4. Scenarios

### A. An order completes

One increment instead of two. The failure mode that produced the drift — one
succeeding while the other fails — cannot occur, because there is nothing to
disagree with.

### B. The community reaches the target

`voting.cron.ts:41` compares progress to target to open the ballot. Both sides
of that comparison now come from the bag goal, so the ballot opens on the number
the home screen was showing all along.

### C. Admin edits the target

Today they can edit either one and the other keeps its own figure. After the
merge there is one field to edit. The voting cycle's `communityGoalTarget`
becomes advisory — recorded on the cycle for history, not consulted.

### D. Existing data disagrees (the live case)

141 vs 30,001 must be reconciled by hand once, at merge time. Neither number is
obviously right: 500/141 looks like the current real goal, 30,000/30,001 looks
like a finished test cycle. **This is the one decision that cannot be made from
the code** — see §6.

### E. No voting cycle exists yet

The bag goal works alone, exactly as it does today. The home banner does not
depend on a voting cycle existing.

### F. No bag goal exists yet

`getStats()` already calls `createDefaultGoal()`. The voting cycle reading from
it gets the default rather than null.

### G. A season is archived

Historical cycles keep their own recorded `communityGoalProgress` — the merge
only changes the **active** cycle's reporting. An archived season must still
show the number it actually finished on.

### H. Two app servers increment at once

`incrementBagCount` already uses an atomic `$inc` under a conditional
`findOneAndUpdate`. Removing the second write removes the only unsafe part.

---

## 5. Order of work

1. **Stop the double write.** Delete the
   `votingService.incrementCommunityGoalProgress` call from the order listener;
   keep `incrementBagCount`.
2. **Make the voting cycle read the bag goal** wherever it reports
   `communityGoalProgress` / `communityGoalTarget` for the _active_ cycle.
   Archived cycles keep their stored values (scenario G).
3. **Reconcile the live data** — one manual decision, see §6.
4. **Retire `incrementCommunityGoalProgress`** once nothing calls it.
5. **Align the winner count.** `PHONE_MAX_RANK` is 3, `recipientCount` is 5 on
   all three existing cycles. One of them has to give — `recipientCount` is
   admin-configurable and should win, with `PHONE_MAX_RANK` deleted.
6. **Collapse the two claim paths.** `prize-claim.service` can only award
   `SMARTPHONE`; `voting-prize.service` awards the voted prize. The bag-goal
   path should defer to the voting cycle's winning prize rather than hardcoding
   a phone.

Steps 1–2 are the merge. 5–6 are the follow-on that removes the last place the
two systems can disagree.

---

## 6. The one thing the code cannot decide

Which numbers are real?

- `communitybaggoals`: **141 / 500**, ends 11 Dec 2026
- `votingcycles` Q2: **30,001 / 30,000**, COMPLETED, winner Electric Scooter

If 500 is the real target, Q2's 30,000 is stale test data and its COMPLETED
status is announcing a prize nobody actually won. If 30,000 is real, the home
banner has been showing a target two orders of magnitude too small.

Whichever survives, the other must be archived or corrected **before** step 2,
or the merge simply picks a winner silently.

---

## 7. Already correct — do not disturb

- `incrementBagCount`'s atomic `$inc` and conditional `findOneAndUpdate`.
- `createDefaultGoal()` so `getStats()` never returns null.
- The WebSocket broadcast after each increment.
- Both UI components. They are not the problem and do not change.

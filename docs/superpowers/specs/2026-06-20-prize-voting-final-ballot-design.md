# Prize Voting — Final 48-Hour Ballot

**Date:** 2026-06-20
**Status:** Ready
**Author:** Salem + Claude

---

## Overview

A weighted prize voting system for the loyalty program. Users who save 50+ bags
**within the current cycle** earn the right to vote on a community prize. Voting
opens for exactly **48 hours** after the community reaches a collective
bag-saving goal (e.g., 30,000 bags). Each user's vote carries weight equal to
their `availablePoints` **snapshotted at ballot open** (not at vote time — this
prevents late-accumulation gaming). The prize with the most total weighted votes
wins. The top N leaderboard users receive the winning prize.

**All dates are stored and compared in UTC.** Cron jobs and API endpoints use
server-side UTC only — never client-provided timestamps for boundary logic.

---

## Core Rules

1. **Per-cycle bag counting:** Only bags saved between `cycleStartDate` and
   the moment the ballot opens count toward eligibility. Not lifetime
   `totalBagsSaved`. Tracked via a `bagsSavedInCycle` field on a
   `VotingEligibility` snapshot document (see Data Model).
2. **Eligibility:** User must have `bagsSavedInCycle >= cycle.minimumBags`
   (default 50) at the time the ballot opens.
3. **Voting window:** 48 hours, starting when the community goal is met.
   Boundary: `now >= ballotOpensAt && now < ballotClosesAt` (inclusive start,
   exclusive end).
4. **One vote, final:** A user votes once per cycle. No changes. Enforced by a
   unique compound index `{ cycleId, userId }` — insert fails on duplicate.
5. **Vote weight = `pointsSnapshot`:** The user's `availablePoints` frozen at
   ballot open (from `VotingEligibility`). Not consumed — points remain
   untouched. Users cannot increase their vote weight after the ballot opens.
6. **Winner = most weighted votes:** Determined by a single aggregation query
   after the ballot closes. Deterministic sort:
   `totalWeightedVotes DESC → voterCount DESC → prizeId ASC`.
7. **Prize recipients = top N leaderboard:** The vote decides WHICH prize. The
   existing leaderboard ranking decides WHO receives it. `recipientCount` is
   configurable per cycle (default 5, validated: `1 <= recipientCount <= 50`).
   Recipients are determined when the admin distributes the prize offline — no
   leaderboard snapshot is taken by the system. The admin views the current
   leaderboard and distributes manually. This is intentionally out of scope
   for this feature.

---

## Architecture

**Approach:** Standalone `VotingModule` in the backend. Reads from
`LoyaltyModule` for eligibility data (bags, points). Does not modify loyalty
data. Own schemas, service, controller, DTOs.

**Module dependency:** `VotingModule` imports `LoyaltyModule` (read-only access
to `LoyaltyAccount`).

### Pre-Requisite Migration: Add `bagCount` to `PointTransaction`

Before building the voting feature, add an optional `bagCount` field to the
`PointTransaction` embedded schema in `LoyaltyAccount`:

```typescript
// In loyalty-account.schema.ts → PointTransaction class
@Prop({ type: Number })
bagCount?: number | undefined;
```

Update `LoyaltyService.addPoints()` to persist `bagCount` on the transaction:

```typescript
const pointTransaction: PointTransaction = {
  amount: multipliedPoints,
  type: 'earned',
  reason: addPointsDto.reason,
  orderId: addPointsDto.orderId ? new Types.ObjectId(addPointsDto.orderId) : undefined,
  // ... existing fields
  ...(addPointsDto.bagCount ? { bagCount: addPointsDto.bagCount } : {}),
};
```

This is a **non-breaking additive change** — existing transactions without
`bagCount` are handled with a fallback of `1` in the snapshot aggregation
(any entry with `orderId` but no `bagCount` counts as 1 bag). New transactions
going forward will have the field populated.

---

## Data Model

### `VotingCycle` Collection

```typescript
@Schema({ timestamps: true })
export class VotingCycle {
  @Prop({ required: true })
  name: string; // "Summer 2026"

  @Prop({ type: Date, required: true })
  cycleStartDate: Date;

  @Prop({ type: Date, required: true })
  cycleEndDate: Date; // 6-month cycle boundary

  @Prop({ required: true })
  communityGoalTarget: number; // e.g., 30000

  @Prop({ type: Date })
  communityGoalMetAt?: Date; // null until goal reached

  @Prop({ type: Date })
  ballotOpensAt?: Date; // = communityGoalMetAt

  @Prop({ type: Date })
  ballotClosesAt?: Date; // = communityGoalMetAt + 48h

  @Prop({ required: true })
  cycleNumber: number; // assigned atomically (see Cycle Number Assignment)

  @Prop({
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'BALLOT_OPEN', 'TALLYING', 'COMPLETED', 'EXPIRED', 'ARCHIVED'],
    default: 'DRAFT',
  })
  status: string;

  @Prop({ default: 50 })
  minimumBags: number; // validated: 1 <= minimumBags <= 500

  @Prop({ default: 5 })
  recipientCount: number; // validated: 1 <= recipientCount <= 50

  @Prop({ type: [PrizeOptionSchema] })
  prizes: PrizeOption[];

  @Prop({ type: VotingWinnerSchema })
  winner?: VotingWinner;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  // Sentinel for DB-level single-active-cycle protection.
  // true when ACTIVE/BALLOT_OPEN/TALLYING. null otherwise.
  @Prop({ type: Boolean, default: null })
  isLive?: boolean | null;

  // Snapshot readiness flag. Set to true after VotingEligibility
  // documents are successfully created. Voting is blocked until true.
  @Prop({ type: Boolean, default: false })
  snapshotReady: boolean;

  // Incremental counter — O(1) reads for community goal progress.
  // Incremented via $inc when orders complete during ACTIVE status.
  @Prop({ default: 0 })
  communityGoalProgress: number;

  // Denormalized for querying: "show all cycles won by Phone".
  // Set at tally time alongside winner embedded doc.
  @Prop({ type: Types.ObjectId })
  winnerPrizeId?: Types.ObjectId;
}
```

**Indexes:**
- `{ cycleNumber: 1 }` — unique
- `{ status: 1 }` — cron lookups by status
- `{ isLive: 1 }` — **partial unique index** where `isLive: true`. Prevents
  multiple active cycles at the DB level, safe against concurrent admin requests.
- `{ winnerPrizeId: 1 }` — **sparse** (only exists on completed cycles).
  Enables "show all cycles won by X prize" queries.

```typescript
VotingCycleSchema.index(
  { isLive: 1 },
  { unique: true, partialFilterExpression: { isLive: true } },
);
```

### Cycle Number Assignment

`cycleNumber` is assigned atomically using a counter collection to prevent
"read max + 1" races:

```typescript
// Counter collection: { _id: 'votingCycle', seq: number }
const counter = await this.counterModel.findOneAndUpdate(
  { _id: 'votingCycle' },
  { $inc: { seq: 1 } },
  { upsert: true, new: true },
);
newCycle.cycleNumber = counter.seq;
```

### `PrizeOption` (Embedded Sub-document)

**Note:** Sub-documents below use abbreviated field notation for readability.
Implementations must add `@Schema({ _id: false })` (or `_id: true` for
PrizeOption since it needs `_id`) and `@Prop()` decorators as per NestJS +
Mongoose patterns.

```typescript
@Schema()
class PrizeOption {
  _id: Types.ObjectId; // auto-generated, stable once created

  @Prop({ required: true })
  name: string;         // "Phone"

  @Prop({ required: true })
  description: string;  // "Latest smartphone model"

  @Prop({ required: true })
  imageUrl: string;     // validated: must match trusted CDN pattern (see Security section)

  @Prop({ required: true, enum: PrizeCategory })
  category: PrizeCategory;

  @Prop({ required: true })
  value: string;        // "1000 DT", "5 days"
}
```

**`PrizeCategory` enum:**
`PHONE` | `HOTEL_STAY` | `SHOPPING_VOUCHER` | `GYM_MEMBERSHIP` |
`ELECTRIC_SCOOTER` | `CUSTOM`

No counters on PrizeOption. Results computed on demand via aggregation.

**Prize ID stability in DRAFT:** When editing prizes in DRAFT status, the
entire `prizes` array is replaced (not patched). This is safe because no votes
or eligibility records reference DRAFT prizes. Once the cycle leaves DRAFT,
prizes are immutable.

### `VotingWinner` (Embedded Sub-document)

```typescript
@Schema({ _id: false })
class VotingWinner {
  @Prop({ type: Types.ObjectId, required: true })
  prizeId: Types.ObjectId;

  @Prop({ required: true })
  name: string;              // denormalized prize name

  @Prop({ required: true })
  totalWeightedVotes: number;

  @Prop({ required: true })
  voterCount: number;

  @Prop({ type: Date, required: true })
  announcedAt: Date;
}
```

### `VotingEligibility` Collection (Ballot-Open Snapshot)

Created in bulk when the ballot opens. One document per eligible user. This
freezes both bag counts and vote weight at a single point in time, preventing
all gaming and inconsistency.

```typescript
@Schema()
export class VotingEligibility {
  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  bagsSavedInCycle: number; // bags saved between cycleStartDate and ballotOpensAt

  @Prop({ required: true })
  pointsSnapshot: number; // availablePoints frozen at ballot open

  @Prop({ type: Date, required: true })
  snapshotAt: Date; // when this was captured
}
```

**Indexes:**
- `{ cycleId: 1, userId: 1 }` — **unique compound** (also serves as prefix
  index for cycleId-only queries like participation stats)
- `{ cycleId: 1, bagsSavedInCycle: -1 }` — for counting eligible users

### `Vote` Collection

```typescript
@Schema()
export class Vote {
  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  prizeId: Types.ObjectId;

  @Prop({ required: true })
  pointsSnapshot: number; // copied from VotingEligibility at vote time

  @Prop({ type: Date, required: true })
  votedAt: Date;
}
```

**Note:** No `{ timestamps: true }` — we use the explicit `votedAt` field as
the canonical vote timestamp. No `createdAt`/`updatedAt` needed since votes
are immutable after creation.

**Indexes:**
- `{ cycleId: 1, userId: 1 }` — **unique compound** (enforces one vote per user
  per cycle, insert fails on duplicate)
- `{ cycleId: 1, prizeId: 1 }` — speeds up the tally aggregation

### `VotingAuditLog` Collection

Tracks state transitions. Keep it minimal — add metadata fields later when
actually needed.

```typescript
@Schema({ timestamps: true })
export class VotingAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'VotingCycle', required: true })
  cycleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId; // null for cron-triggered transitions

  @Prop({ required: true })
  action: string; // 'ACTIVATE' | 'OPEN_BALLOT' | 'CLOSE_BALLOT' | 'TALLY' | 'ARCHIVE' | 'MANUAL_TALLY' | 'EXPIRE' | 'RETRY_SNAPSHOT'

  @Prop({ required: true })
  fromStatus: string;

  @Prop({ required: true })
  toStatus: string;

  // timestamps: true gives us createdAt automatically
}
```

---

## Per-Cycle Bag Counting

The existing `LoyaltyAccount.totalBagsSaved` is **lifetime** — useless for
per-cycle eligibility. With the `bagCount` field now on `PointTransaction`
(see Pre-Requisite Migration), we query it directly:

```javascript
db.loyaltyaccounts.aggregate([
  { $unwind: "$pointsHistory" },
  { $match: {
      "pointsHistory.orderId": { $exists: true, $ne: null },
      "pointsHistory.createdAt": {
        $gte: cycleStartDate,
        $lt: ballotOpensAt,
      },
  }},
  { $addFields: {
      bags: { $ifNull: ["$pointsHistory.bagCount", 1] }
  }},
  { $group: {
      _id: "$userId",
      bagsSavedInCycle: { $sum: "$bags" },
  }},
  { $match: { bagsSavedInCycle: { $gte: minimumBags } } },
])
```

Then for each eligible user, look up `availablePoints` from `LoyaltyAccount`
and bulk-insert into `VotingEligibility`.

**Legacy fallback:** Transactions created before the migration lack `bagCount`.
`$ifNull` defaults to `1` — each legacy order entry counts as 1 bag.

### Community Goal Progress — Incremental Counter (O(1) reads)

Instead of repeatedly scanning `pointsHistory` for all users (expensive at
scale), the community goal progress is tracked with an **incremental counter**
on the `VotingCycle` document:

```typescript
// On VotingCycle schema
@Prop({ default: 0 })
communityGoalProgress: number;
```

**How it's updated:** When `LoyaltyService.addPoints()` completes an order
(has `orderId`), it emits an `order.loyalty.processed` event (or the existing
`OrderEventsListener` calls a method on `VotingService`). The voting service
then:

```typescript
await this.votingCycleModel.updateOne(
  { status: 'ACTIVE' },
  { $inc: { communityGoalProgress: bagCount } },
);
```

This is a single atomic `$inc` — O(1), no aggregation, no scanning.

**Cron's role changes:** Instead of aggregating bags, the cron simply reads
`communityGoalProgress` from the cycle document and compares to
`communityGoalTarget`. No Redis cache needed for progress.

**Initial seeding:** When a cycle is activated (`DRAFT → ACTIVE`), if
`cycleStartDate` is in the past (cycle covers an already-started period), run
the per-cycle bag aggregation once to seed `communityGoalProgress`. After that,
increments handle everything.

**Consistency:** Since `$inc` is atomic and each order triggers exactly one
increment, the counter stays accurate. If an order is reversed/cancelled after
points were awarded, the counter may be slightly over-counted — acceptable for
a community goal that's motivational, not financial.

---

## Lifecycle & State Machine

```
DRAFT ──→ ACTIVE ──→ BALLOT_OPEN ──→ TALLYING ──→ COMPLETED ──→ ARCHIVED
                │                                                   ↑
                └──→ EXPIRED ───────────────────────────────────────┘
```

### Atomic State Transitions

All transitions use `findOneAndUpdate` with a **status precondition**. This
guarantees idempotency across multiple backend instances — only one instance
wins the race. Every transition writes a `VotingAuditLog` entry.

```typescript
// Example: ACTIVE → BALLOT_OPEN
const updated = await this.votingCycleModel.findOneAndUpdate(
  { _id: cycleId, status: 'ACTIVE' },  // precondition
  {
    $set: {
      status: 'BALLOT_OPEN',
      isLive: true, // stays true
      communityGoalMetAt: now,
      ballotOpensAt: now,
      ballotClosesAt: new Date(now.getTime() + BALLOT_DURATION_MS),
      snapshotReady: false, // explicitly false until snapshots complete
    },
  },
  { new: true },
);
if (!updated) return; // another instance already transitioned — no-op

// Write audit log
await this.auditLogModel.create({
  cycleId, performedBy: null, action: 'OPEN_BALLOT',
  fromStatus: 'ACTIVE', toStatus: 'BALLOT_OPEN',
  metadata: { communityGoalMetAt: now },
});
```

### Transition Table

| Transition | Trigger | Precondition | Action |
|-----------|---------|--------------|--------|
| `DRAFT → ACTIVE` | Admin activates | `status === 'DRAFT'` | Set `isLive = true`. Partial unique index enforces single active. Audit log. |
| `ACTIVE → BALLOT_OPEN` | Cron: community goal met | `status === 'ACTIVE'` | Set dates, `snapshotReady = false`. Create snapshots. Set `snapshotReady = true`. Push notification. Audit log. |
| `ACTIVE → EXPIRED` | Cron: `cycleEndDate` passed, goal not met | `status === 'ACTIVE'` | Set `isLive = null`. Dashboard shows "Expired — pending admin action". Audit log. |
| `EXPIRED → ARCHIVED` | Admin archives | `status === 'EXPIRED'` | No ballot, no winner. Audit log. |
| `BALLOT_OPEN → TALLYING` | Cron: `ballotClosesAt` reached | `status === 'BALLOT_OPEN'` | No more votes accepted. Audit log. |
| `TALLYING → COMPLETED` | Tally runs (immediate after above) | `status === 'TALLYING'` | Run aggregation. Set `winner`. Set `isLive = null`. Push notification. Audit log. |
| `COMPLETED → ARCHIVED` | Admin archives | `status === 'COMPLETED'` | `isLive` already null. Audit log. |

**Important:** The cron's `ACTIVE → EXPIRED` check must **only** apply when
`status === 'ACTIVE'`. Cycles in `BALLOT_OPEN` status can legitimately have
`now > cycleEndDate` (because the 48h ballot can extend past `cycleEndDate`).
The cron must never expire a `BALLOT_OPEN` cycle.

### Goal Detection — Cron Job

A cron job runs every 5 minutes:

1. Find cycle with `status === 'ACTIVE'`.
2. If none, skip.
3. Read `communityGoalProgress` from the cycle document (O(1) — already
   incremented by order events, no aggregation needed).
4. If `communityGoalProgress >= communityGoalTarget`:
   - Attempt atomic transition `ACTIVE → BALLOT_OPEN` (see above).
   - If transition succeeded (not null):
     - Call `createEligibilitySnapshots(cycleId)` (idempotent).
     - Set `snapshotReady = true` on the cycle.
     - Send push notification via `PushNotificationService` (FCM) to eligible
       users. Device tokens sourced from `NotificationPreference` collection,
       filtered by `VotingEligibility` user IDs.
5. Check: if `now >= cycleEndDate` and status is still `ACTIVE`:
   - Attempt atomic transition `ACTIVE → EXPIRED`.
   - Dashboard shows "Expired — pending admin action" badge.

### Snapshot Creation — `createEligibilitySnapshots(cycleId)`

This is an explicit service method, callable by the cron and by the admin
retry endpoint.

```typescript
async createEligibilitySnapshots(cycleId: ObjectId): Promise<number> {
  const cycle = await this.votingCycleModel.findById(cycleId);

  // 1. Run aggregation to get per-user bag counts in cycle
  //    (see Per-Cycle Bag Counting section for full pipeline)

  // 2. For each eligible user, look up availablePoints from LoyaltyAccount

  // 3. bulkWrite with $setOnInsert (NOT $set) to preserve first-run values:
  await this.eligibilityModel.bulkWrite(
    eligibleUsers.map(u => ({
      updateOne: {
        filter: { cycleId, userId: u.userId },
        update: {
          $setOnInsert: {
            cycleId,
            userId: u.userId,
            bagsSavedInCycle: u.bags,
            pointsSnapshot: u.availablePoints,
            snapshotAt: cycle.ballotOpensAt, // anchored to ballot open time
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  // 4. Set snapshotReady = true on cycle
  await this.votingCycleModel.updateOne(
    { _id: cycleId },
    { $set: { snapshotReady: true } },
  );

  return eligibleUsers.length;
}
```

**Key: `$setOnInsert` (not `$set`)** — if a partial first run already created
some documents, the retry does NOT overwrite them with potentially different
`availablePoints` values. This preserves snapshot consistency: all documents
reflect the state at the first successful ballot-open moment for each user.
New users (not yet snapshotted) are inserted with current values.

**The 48-hour window starts at goal detection time.** Snapshot creation time
(typically < 30s, potentially longer for very large user bases) is absorbed into
the 48-hour window. This is acceptable — the window is generous and the
snapshot delay is negligible at expected scale.

### Snapshot Failure Recovery

If `createEligibilitySnapshots()` throws after the `ACTIVE → BALLOT_OPEN`
transition:
1. Cycle is `BALLOT_OPEN` with `snapshotReady = false`.
2. Voting is blocked (`POST /vote` returns `409 SNAPSHOT_NOT_READY`).
3. On next cron tick, cron detects `BALLOT_OPEN` + `snapshotReady === false`:
   - Retries `createEligibilitySnapshots(cycleId)` (idempotent via
     `$setOnInsert`).
   - On success: sets `snapshotReady = true`.
   - On repeated failure: logs error, admin can investigate.
4. Admin can also trigger snapshot retry via
   `POST /voting/admin/cycles/:id/retry-snapshot`.

### Ballot Close — Cron Job

A cron job runs every minute:

1. Find cycle with `status === 'BALLOT_OPEN'` and `ballotClosesAt <= now`.
2. If none, skip.
3. Attempt atomic transition `BALLOT_OPEN → TALLYING`.
4. If transition succeeded:
   - Run tally aggregation (see below).
   - If votes exist: set winner, transition `TALLYING → COMPLETED`.
   - If zero votes: set `winner = null`, transition `TALLYING → COMPLETED`.
     Admin sees "No votes were cast" on dashboard.
   - Push notification via FCM with result (or "no votes" message).

**`TALLYING` is a transient state.** It is set by the cron immediately before
running the tally aggregation and should resolve to `COMPLETED` within seconds.
If it persists for more than a few minutes, something failed — the admin manual
tally button exists for this case.

### Tally Aggregation (single query, deterministic)

```javascript
db.votes.aggregate([
  { $match: { cycleId: ObjectId("...") } },
  { $group: {
      _id: "$prizeId",
      totalWeightedVotes: { $sum: "$pointsSnapshot" },
      voterCount: { $sum: 1 }
  }},
  { $sort: { totalWeightedVotes: -1, voterCount: -1, _id: 1 } },
])
```

**Deterministic tie-breaking sort:**
1. `totalWeightedVotes DESC` — most weighted votes wins
2. `voterCount DESC` — more individual voters breaks first tie
3. `_id ASC` (prizeId) — deterministic final tie-break, repeatable across
   environments. Effectively picks the prize created first in the array.

**Zero votes:** If the aggregation returns empty, `winner` is set to `null`
and status transitions to `COMPLETED`. Admin dashboard shows "No votes were
cast — no winner for this cycle."

**Idempotent manual tally:** `POST /voting/admin/cycles/:id/tally` checks
status. If `TALLYING`: runs tally and transitions to `COMPLETED`. If already
`COMPLETED`: returns current winner (no-op, no re-tally). Any other status:
returns `400`.

One query. No maintained counters. Runs once after ballot closes.

---

## Field Locking After Activation

Once a cycle leaves `DRAFT`, certain fields are **immutable** to prevent
inconsistency with in-flight data:

| Field | Editable in DRAFT | Editable in ACTIVE | Locked after BALLOT_OPEN |
|-------|------------------|--------------------|--------------------------|
| `name` | Yes | Yes | Yes (display only) |
| `cycleStartDate` | Yes | No | No |
| `cycleEndDate` | Yes | Yes (admin override) | No |
| `communityGoalTarget` | Yes | No | No |
| `minimumBags` | Yes | No | No |
| `recipientCount` | Yes | Yes | No |
| `prizes` (replace array) | Yes | No | No |
| `status` | Via activate | Via transitions only | Via transitions only |

**Prize editing in DRAFT:** Prizes are replaced as a whole array (not patched
by ID). Since no votes or eligibility records exist for DRAFT cycles, prize
IDs can freely change. Once activated, prizes are frozen — IDs are stable for
the lifecycle.

The `PATCH /voting/admin/cycles/:id` endpoint validates these rules. Attempting
to modify a locked field returns `400 Bad Request` with
`FIELD_LOCKED_AFTER_ACTIVATION`.

---

## API Endpoints

### User-Facing (authenticated)

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| `GET` | `/api/v1/voting/active` | Active cycle + eligibility + user's vote | Default (ThrottlerModule global) |
| `POST` | `/api/v1/voting/vote` | Cast vote `{ prizeId }` | `@Throttle({ default: { limit: 5, ttl: 60000 } })` |
| `GET` | `/api/v1/voting/results` | Aggregated results (gated, see below) | `@Throttle({ default: { limit: 10, ttl: 60000 } })` |
| `GET` | `/api/v1/voting/history` | Past completed cycles with winners | Default |

Rate limiting uses the existing `@nestjs/throttler` module already configured
in `app.module.ts` with Redis-backed store. Per-route overrides via
`@Throttle()` decorator.

### `GET /voting/active` — No Active Cycle

When no live cycle exists, returns `200` with `cycle: null`:

```typescript
{
  status: 'success',
  data: {
    cycle: null,
    eligibility: null,
    myVote: null,
  }
}
```

This avoids frontend branching between 200 and 404. Mobile hides the voting
card when `cycle === null`.

### `GET /voting/active` — Active Cycle Response

```typescript
{
  status: 'success',
  data: {
    cycle: {
      id: string;
      name: string;
      status: CycleStatus;
      cycleStartDate: string;   // ISO 8601 UTC
      cycleEndDate: string;     // ISO 8601 UTC
      communityGoalTarget: number;
      communityGoalProgress: number; // per-cycle bags (incremental counter, real-time)
      ballotOpensAt: string | null;  // ISO 8601 UTC
      ballotClosesAt: string | null; // ISO 8601 UTC
      prizes: PrizeOption[];         // metadata only, no vote counts
      winner: VotingWinner | null;
      recipientCount: number;
    };
    eligibility: {
      canVote: boolean;
      reason?: 'NOT_ENOUGH_BAGS' | 'BALLOT_NOT_OPEN' | 'ALREADY_VOTED'
             | 'SNAPSHOT_NOT_READY';
      userBagsInCycle: number;
      requiredBags: number;
      pointsSnapshot: number;
    };
    myVote: {
      prizeId: string;
      pointsSnapshot: number;
      votedAt: string;           // ISO 8601 UTC
    } | null;
  }
}
```

**`eligibility.userBagsInCycle` source by status:**
- **BALLOT_OPEN / COMPLETED:** From `VotingEligibility` document (frozen
  snapshot). Fast indexed lookup.
- **ACTIVE (pre-ballot):** Single-user aggregation on that user's
  `pointsHistory` (entries with `orderId` and `createdAt >= cycleStartDate`).
  This is a single-user query (not a full scan), acceptable per-request. Cached
  per-user in Redis: key `voting:user_bags:{cycleId}:{userId}`, TTL 5 minutes.
- **No active cycle:** `null` (eligibility is null).

**`eligibility.pointsSnapshot` source by status:**
- **BALLOT_OPEN / COMPLETED:** From `VotingEligibility.pointsSnapshot` (frozen).
- **ACTIVE (pre-ballot):** Current `LoyaltyAccount.availablePoints` (live,
  informational only — will be frozen at ballot open).

### `POST /voting/vote` — Error Codes

Stable error codes for frontend handling:

| Error Code | HTTP | Condition |
|------------|------|-----------|
| `BALLOT_NOT_OPEN` | 400 | Cycle status is not `BALLOT_OPEN` |
| `BALLOT_CLOSED` | 400 | `now >= ballotClosesAt` |
| `NOT_ELIGIBLE` | 403 | User not in `VotingEligibility` for this cycle |
| `ALREADY_VOTED` | 409 | User already voted (service check or unique index) |
| `INVALID_PRIZE` | 400 | `prizeId` not in cycle's prizes array |
| `SNAPSHOT_NOT_READY` | 409 | `snapshotReady === false` on the cycle |
| `NO_ACTIVE_CYCLE` | 404 | No live voting cycle exists |

### `GET /voting/results` — Visibility + Targeting

```
GET /api/v1/voting/results?cycleId=optional
```

- If `cycleId` omitted: returns results for the current live cycle.
- If `cycleId` provided: returns results for that specific cycle (must be
  `BALLOT_OPEN`, `COMPLETED`, or `ARCHIVED`).
- If no live cycle and no `cycleId`: returns `404`.

**Visibility rules (enforced on backend):**
- If ballot is `BALLOT_OPEN`: return results **only if the requesting user has
  already voted** for this cycle. Otherwise return `403` with
  `VOTE_FIRST_TO_SEE_RESULTS`.
- If ballot is `COMPLETED` or `ARCHIVED`: return results to everyone.
- If status is `ACTIVE` or `DRAFT`: return `404`.

Results payload includes **aggregated totals per prize only** — no individual
voter identities or user-level data (privacy default).

Cached in Redis: key `voting:results:{cycleId}`, TTL 60 seconds.

### Admin (ADMIN / MODERATOR role guard)

All admin actions are recorded in `VotingAuditLog`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/voting/admin/cycles` | List all cycles (paginated) |
| `POST` | `/api/v1/voting/admin/cycles` | Create cycle with prizes |
| `PATCH` | `/api/v1/voting/admin/cycles/:id` | Edit cycle (field locking enforced per status) |
| `DELETE` | `/api/v1/voting/admin/cycles/:id` | Delete (only `DRAFT`) |
| `POST` | `/api/v1/voting/admin/cycles/:id/activate` | `DRAFT → ACTIVE` |
| `POST` | `/api/v1/voting/admin/cycles/:id/archive` | `COMPLETED → ARCHIVED` or `EXPIRED → ARCHIVED` |
| `GET` | `/api/v1/voting/admin/cycles/:id/stats` | Full breakdown: per-prize weighted votes, voter counts, eligible count, participation rate |
| `POST` | `/api/v1/voting/admin/cycles/:id/tally` | Manual tally (only `TALLYING`; if already `COMPLETED`, returns current winner as no-op) |
| `POST` | `/api/v1/voting/admin/cycles/:id/retry-snapshot` | Retry snapshot creation (only `BALLOT_OPEN` + `snapshotReady === false`) |

---

## Mobile UI

### Voting Card on Loyalty Screen

Positioned between `ImpactStatsRow` and `StreakCard`. Shows **only the current
state and one primary action** — details behind "View Details" or the bottom
sheet.

| Cycle State | Card Content |
|-------------|-------------|
| `ACTIVE`, goal not met | Icon + "Community Challenge" title + compact progress text: "12,400 / 30,000 bags" + "View Details" link |
| `ACTIVE`, user < 50 bags | Same + subtle text: "Save X more bags to unlock voting" |
| `BALLOT_OPEN`, not eligible | "Voting is live!" + "You need 50 bags to participate" |
| `BALLOT_OPEN`, eligible, not voted | "Voting is live!" + **"Vote Now"** primary CTA button + countdown "47h 14m left" |
| `BALLOT_OPEN`, already voted | "You voted!" badge + their choice name + "View Results" link |
| `COMPLETED` | Winner prize name + image + "View Details" link |
| No active cycle (`cycle: null`) | Card hidden entirely |

### Vote Bottom Sheet

Opens when user taps "Vote Now":

1. **Header:** "Choose the Community Prize" + subtitle showing their vote power:
   "Your vote carries **100 pts**" (from `VotingEligibility.pointsSnapshot`)
2. **Prize cards:** Vertical list, each card shows image thumbnail, name,
   description, value. Tap to select (primary border + checkmark).
3. **CTA button:** `"Cast My Final Vote (100 pts)"` — the button text itself
   communicates finality. No separate confirmation dialog.
4. On success: bottom sheet closes, card updates to "You voted!" state.
5. On `SNAPSHOT_NOT_READY` error: show "Voting is being prepared, try again in
   a few minutes."

### Results View

Accessed via "View Results" link (only shown after user has voted):

- Opens as a screen or expanded bottom sheet
- Vertical list of prizes sorted by weighted votes (descending)
- Each row: prize image, name, horizontal progress bar (% of total weighted
  votes), vote count label
- No individual voter identities shown (privacy)
- Leading prize highlighted with `primary` color
- **Auto-refresh only while this view is visible** — 60-second interval matching
  Redis cache TTL. Stops when user navigates away. Disabled when ballot is
  `COMPLETED` (final results, no refresh needed).

### Past Results

- "Past Votes" link at bottom of voting card (when cycle is `COMPLETED`)
- Simple FlatList: cycle name, winning prize image + name, date
- No pagination needed initially (cycles are 6 months, slow growth)

### Data Fetching

- `useQueryWithFocus` for `GET /voting/active` — refetch on screen focus
- Results query: `refetchInterval: 60_000`, `enabled` only when the results
  view is visible AND ballot is `BALLOT_OPEN` AND user has voted
- Vote mutation: `useMutation` → invalidate `voting/active` query on success

---

## Web UI (Admin Dashboard)

### Two Separate Pages

**1. Cycle Management** — `(admin)/admin/voting/page.tsx`

- **Cycles table:** Name, dates, status badge, community goal progress, actions
  (edit/activate/archive/delete)
- Status includes `EXPIRED` badge (destructive color) for cycles past their end
  date without reaching the goal — prompts admin to archive
- **"Create Cycle" button** → dialog form:
  - Name, start date, end date
  - Community goal target (number input, default 30,000)
  - Minimum bags to vote (number input, default 50, validated 1–500)
  - Recipient count (number input, default 5, validated 1–50)
  - **Prize builder:** Add/remove prizes. Each prize row: name, description,
    category dropdown, value, image URL. Pre-populated with 5 standard prizes
    (admin can customize/reorder/remove/add)
- Edit form: same dialog, pre-filled. **Field locking enforced** — locked fields
  shown as read-only with a lock icon when cycle is past `DRAFT`.
- Status badge colors follow existing pattern:
  `DRAFT → muted`, `ACTIVE → primary`, `BALLOT_OPEN → warning`,
  `TALLYING → warning`, `COMPLETED → success`, `EXPIRED → destructive`,
  `ARCHIVED → muted`

**2. Live Dashboard** — `(admin)/admin/voting/dashboard/page.tsx`

Shows current active/ballot cycle only. Sections:

- **Cycle status header:** Name, status badge, dates, countdown (to goal or
  ballot close)
- **Community goal progress:** Large progress bar with bags count (per-cycle).
  Label: "Updates every ~5 minutes"
- **Eligibility stats:** Total eligible users (50+ bags), total users in cycle
- **Snapshot status** (when `BALLOT_OPEN`): indicator showing if snapshot is
  ready. If not, "Retry Snapshot" button.
- **Ballot section** (visible when `BALLOT_OPEN` or later):
  - Bar chart: each prize with weighted vote total + voter count
  - Participation rate: voted / eligible
  - Auto-refreshes every 60s while ballot is open
  - Countdown to ballot close
- **Winner panel** (visible when `COMPLETED`):
  - Winning prize card with total votes + voter count
  - Recipient count reminder: "Top {N} leaderboard users receive this prize"
  - Link to leaderboard page for admin to identify recipients
  - "Tally Results" manual button (only visible during `TALLYING` as fallback)
- **Expired state:** "Community goal was not met. Archive this cycle to start
  a new one."
- **No votes state:** "No votes were cast — no winner for this cycle."
- **No active cycle state:** "No active voting cycle. Create one from Cycle
  Management."

---

## Shared Types (packages/shared)

New types added to `@foodwaste/shared`:

```typescript
enum CycleStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  BALLOT_OPEN = 'BALLOT_OPEN',
  TALLYING = 'TALLYING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
}

enum PrizeCategory {
  PHONE = 'PHONE',
  HOTEL_STAY = 'HOTEL_STAY',
  SHOPPING_VOUCHER = 'SHOPPING_VOUCHER',
  GYM_MEMBERSHIP = 'GYM_MEMBERSHIP',
  ELECTRIC_SCOOTER = 'ELECTRIC_SCOOTER',
  CUSTOM = 'CUSTOM',
}
```

After the backend is built, run `pnpm generate` in `packages/shared` to
generate proper API types. All frontend code uses `ApiSchemas['...']` — no
manual type duplication.

---

## Notifications

Push notifications use the existing `PushNotificationService` which wraps
Firebase Admin SDK (FCM). Device tokens are stored in the
`NotificationPreference` collection. Eligible user IDs come from
`VotingEligibility`.

| Event | Channel | Message |
|-------|---------|---------|
| Ballot opens | Push (mobile) via FCM | "Voting is live! Choose the community prize — you have 48 hours" |
| Ballot closes + winner | Push (mobile) via FCM | "The community has spoken! [Prize Name] wins!" |
| Ballot closes + no votes | Push (mobile) via FCM | "The voting period has ended with no votes cast." |
| Ballot opens | In-app (web admin) | Dashboard auto-updates via existing Socket.IO |

Only eligible users (in `VotingEligibility` for this cycle) receive the
ballot-open push notification.

---

## Security & Validation

### Vote Endpoint

- `POST /voting/vote` validates:
  - Cycle exists and status is `BALLOT_OPEN`
  - `cycle.snapshotReady === true`
  - `now >= ballotOpensAt && now < ballotClosesAt` (inclusive start, exclusive
    end)
  - `prizeId` exists in the cycle's prizes array
  - User exists in `VotingEligibility` for this cycle (frozen eligibility)
  - User has not already voted (service checks first for friendly error,
    unique index is the hard enforcer)
- `pointsSnapshot` on the `Vote` document is **copied from
  `VotingEligibility.pointsSnapshot`** — never from client input
- Rate limited: `@Throttle({ default: { limit: 5, ttl: 60000 } })`

### Admin Endpoints

- All guarded by `RoleGuard(ADMIN, MODERATOR)`
- All state transitions write to `VotingAuditLog`
- All DTOs use `class-validator` decorators
- `recipientCount` validated: `@Min(1) @Max(50)`
- `minimumBags` validated: `@Min(1) @Max(500)`
- `imageUrl` on prizes validated with regex:
  `/^https:\/\/(res\.cloudinary\.com|storage\.googleapis\.com|cdn\.toofreshtoowaste\.com)\//`
  (matches existing CDN domains used in the project — adjust if CDN changes)

### Results Endpoint

- `GET /voting/results` enforces vote-first-to-see rule on backend
- Rate limited: `@Throttle({ default: { limit: 10, ttl: 60000 } })`
- Returns only aggregated totals — no voter identities

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User saves bags during 48h ballot | Does NOT affect eligibility — snapshot was taken at ballot open. They must qualify before the ballot opens. |
| User earns points during 48h ballot | Does NOT affect vote weight — `pointsSnapshot` frozen at ballot open via `$setOnInsert`. |
| Community goal met with < 48h left in cycle | Ballot still opens for 48h (can extend past `cycleEndDate`). The cycle boundary is for bag counting, not ballot timing. |
| Goal never met by `cycleEndDate` | Cron transitions to `EXPIRED`. Admin archives when ready. No silent stale cycles. |
| Tie in weighted votes | Deterministic: `totalWeightedVotes DESC, voterCount DESC, prizeId ASC`. Repeatable across environments. |
| Zero votes cast | `winner = null`. Cycle still transitions to `COMPLETED`. Dashboard shows "No votes cast." |
| User has 0 available points but 50+ bags | Can vote, but vote carries 0 weight. Allowed — participation matters. |
| Two active cycles (race condition) | DB-level: partial unique index on `isLive = true`. Second attempt gets duplicate key error. |
| Cron misses ballot close | Admin "Tally Results" button (only `TALLYING`; idempotent if already `COMPLETED`). |
| Multiple cron instances fire simultaneously | Atomic `findOneAndUpdate` with status precondition — only one wins. Losers get `null` and no-op. |
| Admin edits active cycle prizes | Blocked — prizes locked after `DRAFT`. Returns `400 FIELD_LOCKED_AFTER_ACTIVATION`. |
| Snapshot fails after ballot opens | `snapshotReady = false`. Voting blocked. Cron retries on next tick with `$setOnInsert` (preserves existing snapshots). Admin can trigger manual retry. |
| Snapshot partial run, then retry | `$setOnInsert` preserves first-run values for already-snapshotted users. New users inserted with current values. No overwrites. |
| Manual tally called twice | First call: tallies and transitions `TALLYING → COMPLETED`. Second call: detects `COMPLETED`, returns current winner (no-op). |
| Vote at exact `ballotClosesAt` timestamp | Rejected — boundary is `now < ballotClosesAt` (exclusive end). |
| Redis down during goal progress check | Falls back to direct DB aggregation. Logs warning. |
| Redis down during results cache | Falls back to direct aggregation. Slower but correct. |
| Admin never archives expired cycle | `EXPIRED` status is visible + highlighted in admin dashboard. `isLive = null` so it doesn't block new cycles. |
| Cron checks BALLOT_OPEN cycle against cycleEndDate | Does NOT expire it. Only `status === 'ACTIVE'` cycles are checked for expiry. |
| No active cycle — `GET /voting/active` | Returns `200` with `cycle: null`. Mobile hides voting card. |
| No active cycle — `GET /voting/results` without cycleId | Returns `404`. |

---

## Test Plan

### Unit Tests (Backend — `voting.service.spec.ts`)

**Eligibility & Snapshots:**
- User with 50+ bags in cycle is eligible
- User with 49 bags in cycle is NOT eligible
- User with 50+ lifetime bags but < 50 in current cycle is NOT eligible
- `pointsSnapshot` is taken from `VotingEligibility`, not current
  `LoyaltyAccount`
- Snapshot correctly counts bags only between `cycleStartDate` and ballot open
- Snapshot uses `$setOnInsert` — second run does NOT overwrite first-run values
- Snapshot failure leaves `snapshotReady = false`
- Retry after snapshot failure inserts missing users, preserves existing ones

**Voting:**
- Eligible user can cast a vote successfully
- Vote records correct `pointsSnapshot` from `VotingEligibility`
- Duplicate vote attempt returns `ALREADY_VOTED` (not raw MongoDB error)
- Vote with invalid `prizeId` returns `INVALID_PRIZE`
- Vote when ballot is not open returns `BALLOT_NOT_OPEN`
- Vote after `ballotClosesAt` returns `BALLOT_CLOSED`
- Vote at exact `ballotClosesAt` is rejected (exclusive end boundary)
- Vote at exact `ballotOpensAt` is accepted (inclusive start boundary)
- Vote from non-eligible user returns `NOT_ELIGIBLE`
- Vote when `snapshotReady = false` returns `SNAPSHOT_NOT_READY`
- User with 0 points can vote (weight = 0)

**State Transitions:**
- `DRAFT → ACTIVE` succeeds when no other live cycle exists
- `DRAFT → ACTIVE` fails when another live cycle exists (partial unique index)
- `ACTIVE → BALLOT_OPEN` sets all date fields correctly
- `ACTIVE → BALLOT_OPEN` creates `VotingEligibility` snapshots
- `ACTIVE → EXPIRED` when `cycleEndDate` passed
- `EXPIRED → ARCHIVED` by admin
- `BALLOT_OPEN → TALLYING` rejects new votes
- `TALLYING → COMPLETED` sets winner correctly
- `TALLYING → COMPLETED` with zero votes sets `winner = null`
- Transition with wrong precondition status returns null (idempotent)
- Concurrent transitions: only one succeeds (mock concurrent calls)
- All transitions create audit log entries

**Tally:**
- Single prize with votes → that prize wins
- Multiple prizes → highest weighted votes wins
- Tie in weighted votes → higher voter count wins
- Tie in both weighted votes and voter count → lower prizeId wins (deterministic)
- Zero votes → winner is null, status still transitions to COMPLETED
- Manual tally when already COMPLETED → returns current winner (no-op)
- Manual tally when not TALLYING → returns 400

**Field Locking:**
- Can edit all fields in DRAFT (including full prize array replacement)
- Cannot edit `prizes`, `minimumBags`, `communityGoalTarget`, `cycleStartDate`
  in ACTIVE
- Cannot edit any locked field after BALLOT_OPEN
- Can edit `name`, `recipientCount` in ACTIVE
- Locked field attempt returns `FIELD_LOCKED_AFTER_ACTIVATION`

**Results Visibility:**
- User who voted can see results during BALLOT_OPEN
- User who has NOT voted gets 403 `VOTE_FIRST_TO_SEE_RESULTS` during BALLOT_OPEN
- Everyone can see results after COMPLETED
- Results return 404 before ballot opens
- Results payload contains no voter identities
- Results with `?cycleId=` returns that specific cycle's results
- Results with no cycleId and no active cycle returns 404

**Validation:**
- `recipientCount` < 1 or > 50 rejected
- `minimumBags` < 1 or > 500 rejected
- `cycleNumber` is atomically assigned (no gaps under concurrent creation)
- `imageUrl` not matching CDN pattern is rejected

### Unit Tests (Backend — `voting.cron.spec.ts`)

- Cron skips when no ACTIVE cycle exists
- Cron detects goal met and triggers transition
- Cron does not double-trigger (idempotent via status precondition)
- Cron detects ballot close and triggers tally
- Cron handles snapshot creation failure (leaves `snapshotReady = false`)
- Cron retries snapshot when `BALLOT_OPEN` + `snapshotReady = false`
- Cron transitions `ACTIVE → EXPIRED` when `cycleEndDate` passed
- Cron does NOT expire `BALLOT_OPEN` cycles even if past `cycleEndDate`
- Redis miss/error: cron falls back to DB aggregation for goal progress

### Integration Tests (Backend)

- Full cycle: create → activate → goal met → ballot open → vote → ballot close
  → tally → winner announced
- Full cycle with no votes: → tally → no winner
- Full cycle with goal not met: → expired → archived
- Concurrent vote attempts from same user: one succeeds, one fails
- Concurrent activation of two cycles: one succeeds, one fails
- Snapshot retry flow: fail → blocked voting → retry → success → voting works
- Boundary-time tests: vote at exact `ballotOpensAt` (accepted), vote at exact
  `ballotClosesAt` (rejected)
- Deterministic tie-break: three prizes, two tied on weight and voters → lower
  prizeId wins

### Unit Tests (Mobile)

- Voting card renders correct state for each cycle status
- Voting card hidden when `cycle === null`
- Vote bottom sheet shows `pointsSnapshot` from eligibility
- Vote mutation invalidates active query on success
- `SNAPSHOT_NOT_READY` error shows retry message
- Results view only renders when user has voted
- Results auto-refresh is disabled when ballot is COMPLETED

### Unit Tests (Web Admin)

- Cycle table renders all statuses with correct badges (including EXPIRED)
- Create form validates required fields and bounds (recipientCount, minimumBags)
- Edit form disables locked fields based on cycle status
- Live dashboard shows progress bar with per-cycle bags
- Tally button only visible during TALLYING status
- Expired cycle shows archive prompt
- Snapshot retry button visible when `snapshotReady = false`

---

---

## Files to Create/Modify

### New Files (Backend)
- `apps/food-waste-backend/src/voting/voting.module.ts`
- `apps/food-waste-backend/src/voting/voting.controller.ts`
- `apps/food-waste-backend/src/voting/voting.service.ts`
- `apps/food-waste-backend/src/voting/voting-admin.controller.ts`
- `apps/food-waste-backend/src/voting/schemas/voting-cycle.schema.ts`
- `apps/food-waste-backend/src/voting/schemas/vote.schema.ts`
- `apps/food-waste-backend/src/voting/schemas/voting-eligibility.schema.ts`
- `apps/food-waste-backend/src/voting/schemas/voting-audit-log.schema.ts`
- `apps/food-waste-backend/src/voting/schemas/counter.schema.ts`
- `apps/food-waste-backend/src/voting/dto/create-cycle.dto.ts`
- `apps/food-waste-backend/src/voting/dto/update-cycle.dto.ts`
- `apps/food-waste-backend/src/voting/dto/cast-vote.dto.ts`
- `apps/food-waste-backend/src/voting/voting.cron.ts`
- `apps/food-waste-backend/src/voting/voting.constants.ts`
- `apps/food-waste-backend/src/voting/__tests__/voting.service.spec.ts`
- `apps/food-waste-backend/src/voting/__tests__/voting.cron.spec.ts`
- `apps/food-waste-backend/src/voting/__tests__/voting.integration.spec.ts`

### New Files (Mobile)
- `apps/mobile/src/features/voting/` — screens, components, hooks, services,
  types (vertical slice)
- `apps/mobile/src/features/voting/__tests__/` — component + hook tests

### New Files (Web)
- `apps/web/src/app/[locale]/(admin)/admin/voting/page.tsx` — cycle management
- `apps/web/src/app/[locale]/(admin)/admin/voting/dashboard/page.tsx` — live
  dashboard
- `apps/web/src/services/voting.ts` — API client
- `apps/web/src/components/dashboard/admin/voting/` — UI components

### Modified Files
- `apps/food-waste-backend/src/loyalty/schemas/loyalty-account.schema.ts` — add `bagCount` to `PointTransaction`
- `apps/food-waste-backend/src/loyalty/loyalty.service.ts` — persist `bagCount` on point transaction
- `apps/food-waste-backend/src/app.module.ts` — register `VotingModule`
- `apps/mobile/src/features/loyalty/screens/LoyaltyScreen.tsx` — add voting card
- `apps/web/src/app/[locale]/(admin)/admin/` — add voting nav item to sidebar
- `packages/shared/src/` — add enums (`CycleStatus`, `PrizeCategory`)

---

## Out of Scope

- Delivery of physical prizes (handled offline by admin)
- Payment/purchase of prizes
- Multiple concurrent voting cycles
- Voting for non-loyalty users (guests)
- WebSocket real-time vote updates (polling with Redis cache is sufficient for a
  48-hour window)
- Prize fulfillment tracking (admin manages offline)
- Leaderboard snapshot for recipient selection (admin uses existing leaderboard
  page to identify top N users and distributes offline)
- Automated recipient notification (admin distributes offline)

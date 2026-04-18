# Leaderboard Consent & Privacy Display

**Date:** 2026-04-17 **Status:** Approved

---

## Summary

Users currently appear in the leaderboard automatically once they accumulate
loyalty points, with no consent prompt. This violates reasonable privacy
expectations — some users do not want their name and photo shown publicly.

This feature adds a one-time, non-dismissible consent modal that gates
leaderboard participation. Users choose either real identity (name + photo) or
anonymous display. The preference can be changed later from the Privacy screen
in Profile settings.

---

## Requirements

1. A user must explicitly opt in before appearing in the leaderboard — no
   implicit inclusion.
2. If `showRealName: true` → display real `firstName`, `lastName`, and
   `profileImage`.
3. If `showRealName: false` → display `"Anonymous"` as the name, `null` as the
   photo. The avatar circle shows `"A"` (derived naturally from
   `"Anonymous"[0]`).
4. The consent modal is non-dismissible — the user cannot close it without
   tapping one of the two buttons.
5. The user can change their preference at any time via Profile → Privacy →
   Leaderboard Display.
6. Users who have not set their preference are excluded from the leaderboard
   query entirely.

---

## Architecture

### Data flow

```
User opens Leaderboard tab
  └─ GET /loyalty/leaderboard
       └─ response includes hasSetConsent: boolean
            ├─ false → render PrivacyConsentModal (non-dismissible)
            │    └─ user taps a button
            │         └─ PATCH /loyalty/leaderboard-consent { showRealName }
            │              └─ on success → invalidate leaderboard query → modal closes
            └─ true → render leaderboard normally (user already in list if they have points)

User opens Profile → Privacy
  └─ LeaderboardDisplayRow shows current setting
       └─ user taps Edit → same PrivacyConsentModal opens
            └─ PATCH on confirm → updates preference in place
```

---

## Backend Changes

### 1. `LoyaltyAccount` schema — `loyalty-account.schema.ts`

Add a new embedded object to `LoyaltyAccount`:

```typescript
@Schema({ _id: false })
class LeaderboardConsent {
  @Prop({ required: true, default: false })
  given!: boolean;           // true once the user has responded to the prompt

  @Prop({ required: true, default: false })
  showRealName!: boolean;    // true = real identity, false = anonymous

  @Prop({ type: Date, default: null })
  setAt?: Date | null;
}

// On LoyaltyAccount:
@Prop({ type: LeaderboardConsent, default: () => ({}) })
leaderboardConsent!: LeaderboardConsent;
```

No migration needed — Mongoose fills defaults on first read/write for existing
documents.

### 2. `getLeaderboard()` — `loyalty.service.ts`

Add `'leaderboardConsent.given': true` to the `$match` stage so users without
consent are excluded:

```typescript
{ $match: { isActive: true, 'leaderboardConsent.given': true } }
```

The `countDocuments` total must use the same filter.

Also compute `hasSetConsent` for the calling user and include it in the return
value:

```typescript
const callerAccount = await this.loyaltyModel
  .findOne({ userId: currentUserObjectId }, { 'leaderboardConsent.given': 1 })
  .lean();
const hasSetConsent = callerAccount?.leaderboardConsent?.given ?? false;

return { entries, currentUserEntry, total, hasSetConsent };
```

### 3. `mapToLeaderboardEntry()` — `loyalty.service.ts`

Apply anonymous overrides when `showRealName` is false:

```typescript
const showReal = doc.leaderboardConsent?.showRealName ?? true;

return {
  rank,
  userId: doc.userId.toString(),
  firstName: showReal ? (user.firstName ?? 'Unknown') : 'Anonymous',
  lastName: showReal ? (user.lastName ?? '') : '',
  profileImage: showReal ? (user.profileImage ?? user.avatar ?? null) : null,
  currentBadge: mostRecentBadge?.name ?? null,
  currentBadgeType: mostRecentBadge?.type ?? null,
  currentTier: doc.currentTier ?? 'Bronze',
  totalPoints: doc.totalPoints ?? 0,
  isCurrentUser: doc.userId.equals(currentUserObjectId),
};
```

The aggregation pipeline must include `leaderboardConsent` in the projection so
the field is available in `doc`. Update `LeaderboardAggregateDoc` accordingly.

### 4. New endpoint — `loyalty.controller.ts`

```
PATCH /loyalty/leaderboard-consent
Auth: JwtAuthGuard
Body: UpdateLeaderboardConsentDto { showRealName: boolean }
Response: 200 { message, data: { showRealName } }
```

The service method `updateLeaderboardConsent(userId, showRealName)` upserts:

```typescript
await this.loyaltyModel.findOneAndUpdate(
  { userId: new Types.ObjectId(userId) },
  {
    $set: {
      'leaderboardConsent.given': true,
      'leaderboardConsent.showRealName': showRealName,
      'leaderboardConsent.setAt': new Date(),
    },
  },
  { new: true },
);
```

### 5. DTO — `loyalty-account.dto.ts`

```typescript
export class UpdateLeaderboardConsentDto {
  @IsBoolean()
  showRealName!: boolean;
}
```

---

## Shared Package Changes — `packages/shared/src/types/leaderboard.types.ts`

```typescript
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
  total: number;
  hasSetConsent: boolean; // NEW — drives the consent modal on mobile
}
```

`LeaderboardEntry` needs no new fields — `firstName = "Anonymous"` produces
`"A"` naturally in the existing `UserAvatar` initials fallback.

---

## Mobile Changes

### 1. New service method — `leaderboardService.ts`

```typescript
updateLeaderboardConsent(showRealName: boolean, signal?: AbortSignal): Promise<void>
// PATCH /loyalty/leaderboard-consent { showRealName }
```

### 2. New hook — `useLeaderboardConsent.ts`

```typescript
// features/leaderboard/hooks/useLeaderboardConsent.ts
export function useLeaderboardConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (showRealName: boolean) =>
      leaderboardService.updateLeaderboardConsent(showRealName),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['loyalty', 'leaderboard'],
      });
    },
  });
}
```

### 3. New component — `PrivacyConsentModal.tsx`

Location: `features/leaderboard/components/PrivacyConsentModal.tsx`

Props:

```typescript
interface PrivacyConsentModalProps {
  visible: boolean;
  onConsentSaved: () => void; // called after successful PATCH + cache invalidation
}
```

Behaviour:

- Rendered as a `<Modal>` with `transparent`, `animationType="slide"`,
  `statusBarTranslucent`.
- **Non-dismissible**: no `onRequestClose` handler that closes; backdrop press
  is a no-op.
- Style: follows the existing `PrizeModal` pattern — bottom sheet with handle,
  `useSafeAreaInsets` bottom padding, `ScrollView` for content, fixed action
  buttons below scroll area.
- Single step — no navigation between steps, no text input.

Content:

- Icon: 🏆 (large, centered)
- Heading: "Leaderboard Display"
- Body copy: "Your loyalty points are being tracked. Do you want to appear on
  the community leaderboard? You can change this any time in Privacy settings."
- Button 1 (primary, full width): "Show my name & photo" →
  `mutation.mutate(true)`
- Button 2 (outline, full width, below): "Stay anonymous" →
  `mutation.mutate(false)`
- While mutation is in-flight: both buttons disabled, spinner on the tapped one.
- On success: `onConsentSaved()` is called (parent hides the modal).

### 4. `LeaderboardScreen.tsx` changes

```typescript
const hasSetConsent = data?.pages[0]?.hasSetConsent ?? true;
// Default true: don't flash modal before data loads

const [consentModalVisible, setConsentModalVisible] = useState(false);

useEffect(() => {
  if (!isLoading && !hasSetConsent) {
    setConsentModalVisible(true);
  }
}, [isLoading, hasSetConsent]);

// In JSX, above the FlashList:
<PrivacyConsentModal
  visible={consentModalVisible}
  onConsentSaved={() => setConsentModalVisible(false)}
/>
```

The leaderboard content renders underneath — the modal simply covers it. No
empty state is needed while the modal is showing.

> **Note on the bottom pinned user card**: `LeaderboardScreen` renders a pinned
> card at the bottom that uses `firstName`/`lastName`/`avatarUri` from
> `useUserProfile()` (Redux auth state), not from the API `userEntry`. This card
> always shows the user's real identity regardless of consent choice — it is
> visible only to the user themselves. No changes needed here.

### 5. `PrivacyScreen.tsx` changes

Replace the placeholder section with a real leaderboard display row. Requires
the loyalty account response to expose `leaderboardConsent`. Two sub-tasks:

**a. Backend**: include `leaderboardConsent.showRealName` and
`leaderboardConsent.given` in `GET /loyalty/account` response (or
`GET /loyalty/stats`). Add to the DTO/serializer.

**b. Mobile**: in `PrivacyScreen`, fetch `GET /loyalty/account` (likely already
cached by the profile screen via `useUserProfile` or a loyalty hook). Read
`leaderboardConsent` from it.

Row layout:

```
[🏆 icon]  Leaderboard Display           [Edit]
           Showing as: Salem Wachwacha
                  — or —
           Showing as: Anonymous
```

Tapping "Edit" opens `PrivacyConsentModal` with `visible={true}`. After
`onConsentSaved`, the row re-reads from the invalidated query and updates
automatically.

---

## Files Changed

| File                                                                      | Change                                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/food-waste-backend/src/loyalty/schemas/loyalty-account.schema.ts`   | Add `LeaderboardConsent` sub-schema + field                                                                    |
| `apps/food-waste-backend/src/loyalty/loyalty.service.ts`                  | Filter query, `mapToLeaderboardEntry` anonymous logic, `updateLeaderboardConsent()`, `hasSetConsent` in return |
| `apps/food-waste-backend/src/loyalty/loyalty.controller.ts`               | `PATCH /loyalty/leaderboard-consent` endpoint                                                                  |
| `apps/food-waste-backend/src/loyalty/dto/loyalty-account.dto.ts`          | `UpdateLeaderboardConsentDto`                                                                                  |
| `packages/shared/src/types/leaderboard.types.ts`                          | Add `hasSetConsent` to `LeaderboardResponse`                                                                   |
| `apps/mobile/src/features/leaderboard/services/leaderboardService.ts`     | `updateLeaderboardConsent()`                                                                                   |
| `apps/mobile/src/features/leaderboard/hooks/useLeaderboardConsent.ts`     | New hook (PATCH + cache invalidation)                                                                          |
| `apps/mobile/src/features/leaderboard/components/PrivacyConsentModal.tsx` | New non-dismissible modal                                                                                      |
| `apps/mobile/src/features/leaderboard/screens/LeaderboardScreen.tsx`      | Mount modal, drive from `hasSetConsent`                                                                        |
| `apps/mobile/src/features/profile/screens/PrivacyScreen.tsx`              | Replace placeholder with leaderboard display row                                                               |

---

## Out of Scope

- Profanity filtering / moderation (anonymous name input was removed)
- Admin UI for overriding a user's consent
- Retroactive point recalculation when consent changes
- Web dashboard leaderboard (backend changes apply universally; web UI not in
  scope here)

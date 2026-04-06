# How Pickup Date Filtering Works

## 🎯 The Core Concept: Overlap Detection

We use **overlap logic** instead of exact date matching because offers can span multiple days.

---

## 📅 Step-by-Step Example

### Scenario: Current Time

```
NOW (UTC): 2026-01-20T10:30:00.000Z
NOW (Tunisia): 2026-01-20T11:30:00+01:00
```

---

## 🔍 Step 1: Calculate Today's Boundaries (Tunisia Timezone)

```typescript
// In the code:
const now = new Date(); // 2026-01-20T10:30:00.000Z (UTC)

const startOfToday = TimezoneUtil.getStartOfDay(now);
// Returns: 2026-01-19T23:00:00.000Z (UTC)
// Which is: 2026-01-20T00:00:00 Tunisia time (midnight)

const endOfToday = TimezoneUtil.getEndOfDay(now);
// Returns: 2026-01-20T22:59:59.999Z (UTC)
// Which is: 2026-01-20T23:59:59.999 Tunisia time (end of day)
```

**Visual Representation**:

```
Tunisia Time:  |------- Jan 20 (00:00 - 23:59) -------|
UTC Time:      |------- Jan 19 23:00 to Jan 20 22:59 ---|
```

---

## 🔍 Step 2: Query Database with Overlap Logic

```typescript
const query = {
  status: 'ACTIVE',
  isActive: true,
  // Overlap detection:
  availableFrom: { $lte: endOfToday }, // Starts before end of today
  availableUntil: { $gte: startOfToday }, // Ends after start of today
};
```

### Translation:

**"Find all offers where the pickup window overlaps with today"**

An offer is included if:

- It starts before the day ends AND
- It ends after the day starts

---

## 📊 Examples with Real Data

### Example 1: Offer Fully Within Today ✅

```javascript
Offer: {
  availableFrom: "2026-01-20T06:00:00.000Z",  // 7:00 AM Tunisia
  availableUntil: "2026-01-20T18:00:00.000Z"  // 7:00 PM Tunisia
}

Check 1: availableFrom <= endOfToday?
  2026-01-20T06:00:00Z <= 2026-01-20T22:59:59Z ✅ YES

Check 2: availableUntil >= startOfToday?
  2026-01-20T18:00:00Z >= 2026-01-19T23:00:00Z ✅ YES

Result: ✅ INCLUDED in "Pickup Today"
```

---

### Example 2: Offer Spans Yesterday → Today ✅

```javascript
Offer: {
  availableFrom: "2026-01-19T19:00:00.000Z",  // Jan 19, 8:00 PM Tunisia
  availableUntil: "2026-01-20T13:00:00.000Z"  // Jan 20, 2:00 PM Tunisia
}

Check 1: availableFrom <= endOfToday?
  2026-01-19T19:00:00Z <= 2026-01-20T22:59:59Z ✅ YES

Check 2: availableUntil >= startOfToday?
  2026-01-20T13:00:00Z >= 2026-01-19T23:00:00Z ✅ YES

Result: ✅ INCLUDED in "Pickup Today"
Reason: Pickup window overlaps with today (available until 2 PM today)
```

---

### Example 3: Offer Spans Today → Tomorrow ✅

```javascript
Offer: {
  availableFrom: "2026-01-20T19:00:00.000Z",  // Jan 20, 8:00 PM Tunisia
  availableUntil: "2026-01-21T06:00:00.000Z"  // Jan 21, 7:00 AM Tunisia
}

Check 1: availableFrom <= endOfToday?
  2026-01-20T19:00:00Z <= 2026-01-20T22:59:59Z ✅ YES

Check 2: availableUntil >= startOfToday?
  2026-01-21T06:00:00Z >= 2026-01-19T23:00:00Z ✅ YES

Result: ✅ INCLUDED in "Pickup Today"
Reason: Pickup window starts today at 8 PM
```

---

### Example 4: Offer Only Tomorrow ❌

```javascript
Offer: {
  availableFrom: "2026-01-21T06:00:00.000Z",  // Jan 21, 7:00 AM Tunisia
  availableUntil: "2026-01-21T18:00:00.000Z"  // Jan 21, 7:00 PM Tunisia
}

Check 1: availableFrom <= endOfToday?
  2026-01-21T06:00:00Z <= 2026-01-20T22:59:59Z ❌ NO (starts after today ends)

Result: ❌ EXCLUDED from "Pickup Today"
Reason: Pickup window starts tomorrow
```

---

### Example 5: Offer Only Yesterday ❌

```javascript
Offer: {
  availableFrom: "2026-01-19T06:00:00.000Z",  // Jan 19, 7:00 AM Tunisia
  availableUntil: "2026-01-19T18:00:00.000Z"  // Jan 19, 7:00 PM Tunisia
}

Check 1: availableUntil >= startOfToday?
  2026-01-19T18:00:00Z >= 2026-01-19T23:00:00Z ❌ NO (ends before today starts)

Result: ❌ EXCLUDED from "Pickup Today"
Reason: Pickup window ended yesterday
```

---

## 🌍 How Timezone Conversion Works

### TimezoneUtil.getStartOfDay()

```typescript
// Input: 2026-01-20T10:30:00.000Z (UTC)

// Step 1: Convert to Tunisia time
// 2026-01-20T10:30:00.000Z → 2026-01-20T11:30:00+01:00

// Step 2: Get start of day in Tunisia
// 2026-01-20T11:30:00+01:00 → 2026-01-20T00:00:00+01:00

// Step 3: Convert back to UTC
// 2026-01-20T00:00:00+01:00 → 2026-01-19T23:00:00.000Z

// Returns: 2026-01-19T23:00:00.000Z (UTC)
```

### TimezoneUtil.getEndOfDay()

```typescript
// Input: 2026-01-20T10:30:00.000Z (UTC)

// Step 1: Convert to Tunisia time
// 2026-01-20T10:30:00.000Z → 2026-01-20T11:30:00+01:00

// Step 2: Get end of day in Tunisia
// 2026-01-20T11:30:00+01:00 → 2026-01-20T23:59:59.999+01:00

// Step 3: Convert back to UTC
// 2026-01-20T23:59:59.999+01:00 → 2026-01-20T22:59:59.999Z

// Returns: 2026-01-20T22:59:59.999Z (UTC)
```

---

## 🔄 Tomorrow Works the Same Way

For "Pickup Tomorrow", we just shift the date by +1 day:

```typescript
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1); // Add 1 day

const startOfTomorrow = TimezoneUtil.getStartOfDay(tomorrow);
const endOfTomorrow = TimezoneUtil.getEndOfDay(tomorrow);

const query = {
  availableFrom: { $lte: endOfTomorrow },
  availableUntil: { $gte: startOfTomorrow },
};
```

---

## 🎯 Why Overlap Logic?

### ❌ BAD: Exact Date Matching

```typescript
// This would MISS offers that span multiple days!
availableFrom >= startOfToday && availableFrom < endOfToday;
```

**Problem**: An offer from 8 PM yesterday to 2 PM today would be missed.

### ✅ GOOD: Overlap Detection

```typescript
// This catches ALL offers with pickup window overlapping today
availableFrom <= endOfToday && availableUntil >= startOfToday;
```

**Benefit**: Correctly handles:

- Offers fully within today
- Offers spanning yesterday → today
- Offers spanning today → tomorrow
- Multi-day offers

---

## 📖 Visual Timeline

```
                Yesterday      |      Today      |     Tomorrow
                    19         |        20       |        21
================================================================
                          23:00|00:00       23:59|00:00
                              (UTC +1 = Tunisia Midnight)

Offer A:        [=====]        |                 |
                ❌ Excluded     |                 |

Offer B:             [=========|========]        |
                ✅ Included     |                 |

Offer C:                       | [=============] |
                               | ✅ Included     |

Offer D:                       |        [========|======]
                               | ✅ Included     |

Offer E:                       |                 | [=====]
                               |       ❌ Excluded|
```

---

## 🧮 Database Query Generated

```javascript
db.offers.find({
  status: 'ACTIVE',
  isActive: true,
  availableFrom: { $lte: ISODate('2026-01-20T22:59:59.999Z') },
  availableUntil: { $gte: ISODate('2026-01-19T23:00:00.000Z') },
});
```

This translates to:
**"Find offers where pickup window overlaps with 2026-01-20 (Tunisia time)"**

---

## 🔑 Key Takeaways

1. **All dates stored in UTC** in database (universal standard)
2. **Timezone conversion** happens in application code (not database)
3. **Overlap logic** ensures we don't miss multi-day offers
4. **Tunisia timezone** (Africa/Tunis, UTC+1) is the reference
5. **Automatic daylight saving** handled by Luxon library

---

## 🛠️ Testing the Logic

```bash
# Current time: 2026-01-20 11:30 AM Tunisia (10:30 AM UTC)

# This offer should appear in "Pickup Today"
POST /offers
{
  "availableFrom": "2026-01-20T06:00:00.000Z",  # 7 AM Tunisia
  "availableUntil": "2026-01-20T18:00:00.000Z"  # 7 PM Tunisia
}

# This offer should appear in "Pickup Tomorrow"
POST /offers
{
  "availableFrom": "2026-01-21T06:00:00.000Z",  # Tomorrow 7 AM
  "availableUntil": "2026-01-21T18:00:00.000Z"  # Tomorrow 7 PM
}

# This offer should appear in BOTH (spans today → tomorrow)
POST /offers
{
  "availableFrom": "2026-01-20T20:00:00.000Z",  # Today 9 PM Tunisia
  "availableUntil": "2026-01-21T10:00:00.000Z"  # Tomorrow 11 AM Tunisia
}
```

---

**The system is smart enough to handle all edge cases automatically!** 🎉

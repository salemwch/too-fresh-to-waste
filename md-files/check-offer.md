# Check Offer Data

Run this in MongoDB to see the offer that failed:

```javascript
// In MongoDB shell or Compass:
db.offers.findOne(
  { _id: ObjectId('6983d82da2907df08c243a27') },
  {
    title: 1,
    availableFrom: 1,
    availableUntil: 1,
    pickupTimeSlots: 1,
    status: 1,
  },
);
```

## What to look for:

The pickupDate (`2026-02-05T21:27:18.830Z`) was calculated from:

```
pickupDate = MAX(
  now + 30 seconds,
  offer.availableFrom
)
```

So if `offer.availableFrom` was around `21:27`, that explains why pickupDate was `21:27`.

## The Problem

If the offer had:

- `availableFrom`: 2026-02-05T21:27:00.000Z (or earlier)
- `availableUntil`: 2026-02-05T21:30:00.000Z

And you tried to checkout at 22:27:35, the calculation would be:

- earliestPickupTime = MAX(22:27:35 + 30s, 21:27:00) = 22:28:05
- But the OLD buggy code did: MIN(22:28:05, 21:30:00 - 1s) = **21:29:59** ← IN THE PAST!

That's why it failed. My fix prevents this.

# Landing Page Sections Documentation

## Overview

Documentation for all sections of the Too Fresh To Waste landing page.

**Tech Stack:** Next.js 15 | TypeScript 5.8 | Tailwind CSS | React 19

**File Location:** `apps/web/src/components/sections/`

---

## Section 2: App Introduction

**File:** `Section2.tsx`

**Purpose:** Introduces the app's value proposition and provides download
buttons for App Store and Google Play.

**Features:**

- Background color: `#f9f3f0` (cream/beige)
- Title with primary green color (#005250) and rewards emoji
- Subtitle with color `#5F6D6D`
- Two download buttons (App Store, Google Play) with hover effects
- Fully responsive layout

**Content:**

- **Title:** "The app that turns surplus food into savings and rewards 🎁"
- **Secondary title:** "Join the mission to end food waste in Tunisia—together,
  let's make every meal count"
- **Description:** Smart marketplace explanation with 75% discount highlight

**Implementation Status:** ✅ Complete

---

## Section 3: Why Use Too Fresh To Waste - "Cycle of Good" Animation

**Files:** `Section3.tsx` (static version), `Section3Animated.tsx` (animated
version - **ACTIVE**)

**Purpose:** Showcase the circular economy of Too Fresh To Waste - how buying
surplus food creates a continuous cycle of value.

**Current Version:** **Section3Animated** - Interactive circular orbit layout
with Framer Motion

### Features

**Visual Design:**

- Background color: `#f9f3f0` (cream/beige)
- Two-line title with fade-in animation: "WHY USE" (green) + "TOO FRESH TO
  WASTE" (coral red `#ff7973`)
- Centered bag image with scale-in animation
- 4 orbiting benefit icons with pulse effects
- Curved arrows showing the flow between benefits
- Auto-play on scroll into view

**Animations:**

- **Title:** Fade-in from top with staggered delay
- **Bag:** Scale-in from 0.8 to 1.0
- **Icons:** Sequential appearance (top → right → bottom → left)
- **Pulse Effect:** Continuous scale animation (1.0 → 1.15 → 1.0) on each icon
- **Arrows:** Fade-in after icons appear
- **Scroll Trigger:** Animations start when section is 30% in view

**The Circular Flow:**

```
   DISCOUNT (75% OFF)
          ↓ (curved arrow)
   LEAF (Help Planet)
          ↓ (curved arrow)
   COIN (Get Points)
          ↓ (curved arrow)
   PLATE (Earn Rewards)
          ↓ (curved arrow back to top)
```

### Content

**Four Benefits (Clockwise from Top):**

1. **Discount Icon (Top)** - "ENJOY GOOD FOOD UP TO 75% OFF"
2. **Leaf Icon (Right)** - "HELP THE PLANET BY REDUCING FOOD WASTE"
3. **Coin Icon (Bottom)** - "GET POINTS FOR EACH MEALS YOU BUY"
4. **Plate Icon (Left)** - "EARN REWARDS BY REDEEM YOUR POINT"

### Technical Details

**Dependencies:**

- `framer-motion@^12.23.26` - Animation library
- Custom SVG icons in `@/components/icons/CycleIcons.tsx`

**Icon Components:**

- `DiscountIcon` - 75% OFF badge with green circle
- `LeafIcon` - Environmental impact symbol
- `CoinIcon` - Points/rewards symbol with gold accents
- `PlateIcon` - Food reward symbol with colorful food items
- `CurvedArrowRight/Down/Left/Up` - Flow indicators

**Layout Math:**

- Orbit radius: `280px` from center
- Icon positions calculated using trigonometry:
  - Top: `-90°` (270°)
  - Right: `0°`
  - Bottom: `90°`
  - Left: `180°`
- Arrow positions: Midpoint between icons

**Desktop Layout:**

- Min-height: `700px` (lg: `800px`)
- Orbit radius: `280px`
- Icon size: `w-16 h-16` (lg: `w-20 h-20`)
- Arrow size: `w-12 h-12` (lg: `w-16 h-16`)

**Mobile Layout:**

- Centered bag image
- Stacked white cards with shadows
- Icons with pulse on left side of card
- Text on right side
- Slide-in from left animation

**Animation Timing:**

- Title appear: `0.6s`
- Bag scale-in: `0.8s` (delay: `0.4s`)
- Icons sequential: `0.5s` each (stagger: `0.2s`)
- Arrows fade-in: `0.8s` (delay: `1.0s` + stagger)
- Pulse loop: `2.0s` infinite

**Scroll Behavior:**

- Uses `useInView` hook from Framer Motion
- Triggers when section is 30% visible
- `once: false` - animations re-trigger on scroll

**Responsive Behavior:**

- **Desktop (md+):** Circular orbit layout with absolute positioning
- **Mobile (<md):** Vertical stack with card-based layout

**Accessibility:**

- Semantic HTML structure
- Descriptive alt text for bag image
- Proper heading hierarchy (h2, h3)
- High contrast text colors
- Animation doesn't interfere with screen readers

**Implementation Status:** ✅ Complete with Premium Animations

**Reference Image:** `apps/web/src/assets/images/now.jpg`

---

## Usage

Import and use sections in your page:

```tsx
import { Section2, Section3 } from '@/components/sections';

export default function Home() {
  return (
    <>
      <Header />
      <HeroSection />
      <Section2 />
      <Section3 />
      {/* More sections... */}
    </>
  );
}
```

---

## Color Palette Reference

| Color Name       | Hex Code | Tailwind Class                        | Usage                   |
| ---------------- | -------- | ------------------------------------- | ----------------------- |
| Primary Green    | #005250  | `text-primary-500` / `bg-primary-500` | Headers, titles, CTAs   |
| Coral Red        | #ff7973  | Custom `text-[#ff7973]`               | Accent title            |
| Gray Text        | #5F6D6D  | Custom `text-[#5F6D6D]`               | Body text, descriptions |
| Cream Background | #f9f3f0  | Custom `bg-[#f9f3f0]`                 | Section backgrounds     |
| White            | #FFFFFF  | `bg-white`                            | Cards, buttons          |

---

## Assets

| Asset             | Original Path               | Public Path                            | Size   | Format |
| ----------------- | --------------------------- | -------------------------------------- | ------ | ------ |
| Bag               | `src/assets/images/Bag.png` | `/images/Bag.png`                      | 870 KB | PNG    |
| Green Header Logo | N/A                         | `/images/green-header-center.png`      | -      | SVG    |
| White Header Logo | N/A                         | `/images/white-header-center-logo.png` | -      | SVG    |

---

## Next Steps

According to `content.md`, the following sections need to be implemented:

### Section 4: Business Solutions (Lines 25-41)

- Background: `#f9f3f0`
- Title: "OUR BUSINESS SOLUTION" (green)
- Three cards: Surprise Bag, Too Fresh To Waste Solution, Specific Item
- CTA: "JOIN OUR MISSION TO FIGHTING FOOD WASTE TOGETHER"

### Footer (Lines 42-46)

- Background: Green primary color
- Social media icons (Instagram, Facebook, X/Twitter, Threads, TikTok, Bluesky)
- Logo in footer

---

## Files Modified

1. ✅ `apps/web/src/components/sections/Section3.tsx` - Created
2. ✅ `apps/web/src/components/sections/index.ts` - Updated exports
3. ✅ `apps/web/src/app/page.tsx` - Integrated Section3
4. ✅ `apps/web/public/images/Bag.png` - Copied asset

---

## Verification

To verify the implementation:

```bash
# Start the development server
cd apps/web
pnpm dev

# Open browser to http://localhost:3000
# Scroll down to see Section 3
# Test responsive behavior by resizing window
# Verify mobile layout on device or DevTools
```

---

**Last Updated:** 2025-12-31 **Status:** Section 3 Complete ✅

# SEO Plan 4: Milestone & Impact System

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the live impact counter (homepage), /impact hub page,
/competitions landing page, milestone page template, and backend
`publish-readiness` endpoint — following the data contract from Section 4.5 of
the spec. No page exposes data that hasn't been verified by the backend gate.

**Architecture:** Impact counter fetches real-time stats from
`GET /api/v1/impact/live` (existing or new backend endpoint). Static milestone
and impact report pages are generated from MDX files gated by a backend
publish-readiness check in CI. The /competitions and /impact hub pages are
evergreen — no real data needed to publish. The backend adds a
`GET /api/v1/milestones/:id/publish-readiness` endpoint that validates the data
contract before any page generation runs.

**Tech Stack:** Next.js 15 App Router, TypeScript, NestJS 11, MongoDB, Jest +
RTL

**Prerequisite:** Plans 1 + 2 complete (uses `EventSchema`, `WebPageSchema`,
`BreadcrumbSchema`, MDX infrastructure from Plan 2)

---

## File Map

**Create (Frontend):**

- `apps/web/src/components/impact/impact-counter.tsx` — live stats counter
  component
- `apps/web/src/app/[locale]/(marketing)/impact/page.tsx` — /impact hub
  (evergreen)
- `apps/web/src/app/[locale]/(marketing)/competitions/page.tsx` — /competitions
  (evergreen)
- `apps/web/src/app/[locale]/(marketing)/milestones/[slug]/page.tsx` — milestone
  template
- `apps/web/src/app/[locale]/(marketing)/impact/[year]/[month]/page.tsx` —
  monthly impact report
- `apps/web/src/services/impact.service.ts` — API client for impact stats
- `apps/web/src/__tests__/components/impact-counter.test.tsx`

**Create (Backend):**

- `apps/food-waste-backend/src/milestones/milestones.module.ts`
- `apps/food-waste-backend/src/milestones/milestones.controller.ts`
- `apps/food-waste-backend/src/milestones/milestones.service.ts`
- `apps/food-waste-backend/src/milestones/dto/publish-readiness-response.dto.ts`
- `apps/food-waste-backend/src/milestones/milestones.module.spec.ts`

**Modify (Backend):**

- `apps/food-waste-backend/src/app.module.ts` — register MilestonesModule
- `apps/food-waste-backend/src/orders/orders.service.ts` — expose aggregate
  stats for impact counter

---

## Task 1: Backend — impact live stats endpoint

**Files:** `apps/food-waste-backend/src/`

- [ ] **Step 1: Write the service test**

Create `apps/food-waste-backend/src/milestones/milestones.module.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { MilestonesService } from './milestones.service';
import { getModelToken } from '@nestjs/mongoose';

describe('MilestonesService', () => {
  let service: MilestonesService;
  const mockOrderModel = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MilestonesService,
        { provide: getModelToken('Order'), useValue: mockOrderModel },
      ],
    }).compile();
    service = module.get<MilestonesService>(MilestonesService);
  });

  describe('getLiveStats', () => {
    it('returns bag count, CO2 avoided, and charity amount', async () => {
      mockOrderModel.aggregate.mockResolvedValueOnce([
        { totalBagsSaved: 1200, totalCharityTND: 480 },
      ]);
      const result = await service.getLiveStats();
      expect(result.totalBagsSaved).toBe(1200);
      expect(result.co2AvoidedKg).toBe(3000); // 1200 × 2.5
      expect(result.charityAmountTND).toBe(480);
    });

    it('returns zeroes when no orders exist', async () => {
      mockOrderModel.aggregate.mockResolvedValueOnce([]);
      const result = await service.getLiveStats();
      expect(result.totalBagsSaved).toBe(0);
      expect(result.co2AvoidedKg).toBe(0);
    });
  });

  describe('getPublishReadiness', () => {
    it('returns ready: false when bagsSaved below milestone threshold', async () => {
      mockOrderModel.aggregate.mockResolvedValueOnce([
        { totalBagsSaved: 5000, totalCharityTND: 200 },
      ]);
      const result = await service.getPublishReadiness('30000');
      expect(result.ready).toBe(false);
      expect(result.reason).toContain('bags');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @foodwaste/backend test:unit -- --testPathPattern="milestones" --no-coverage
```

Expected: FAIL — `MilestonesService` not found

- [ ] **Step 3: Create `milestones.service.ts`**

Create `apps/food-waste-backend/src/milestones/milestones.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

const CO2_KG_PER_BAG = 2.5;

const MILESTONE_THRESHOLDS: Record<string, number> = {
  '30000': 30000,
  '60000': 60000,
  '90000': 90000,
  '120000': 120000,
};

export interface LiveStats {
  totalBagsSaved: number;
  co2AvoidedKg: number;
  charityAmountTND: number;
}

export interface PublishReadiness {
  ready: boolean;
  reason?: string;
  data?: LiveStats & { milestoneTimestamp?: Date };
}

@Injectable()
export class MilestonesService {
  constructor(@InjectModel('Order') private readonly orderModel: Model<any>) {}

  async getLiveStats(): Promise<LiveStats> {
    const result = await this.orderModel.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          totalBagsSaved: { $sum: '$quantity' },
          totalCharityTND: { $sum: '$charityAmount' },
        },
      },
    ]);

    const row = result[0] ?? { totalBagsSaved: 0, totalCharityTND: 0 };
    return {
      totalBagsSaved: row.totalBagsSaved,
      co2AvoidedKg: row.totalBagsSaved * CO2_KG_PER_BAG,
      charityAmountTND: row.totalCharityTND,
    };
  }

  async getPublishReadiness(milestoneId: string): Promise<PublishReadiness> {
    const threshold = MILESTONE_THRESHOLDS[milestoneId];
    if (!threshold) {
      return { ready: false, reason: `Unknown milestone ID: ${milestoneId}` };
    }

    const stats = await this.getLiveStats();

    if (stats.totalBagsSaved < threshold) {
      return {
        ready: false,
        reason: `Platform has saved ${stats.totalBagsSaved} bags — milestone requires ${threshold} bags`,
      };
    }

    return {
      ready: true,
      data: {
        ...stats,
        milestoneTimestamp: new Date(),
      },
    };
  }
}
```

- [ ] **Step 4: Create `milestones.controller.ts`**

Create `apps/food-waste-backend/src/milestones/milestones.controller.ts`:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('milestones')
@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get('live-stats')
  @ApiOperation({ summary: 'Get live platform impact statistics' })
  getLiveStats() {
    return this.milestonesService.getLiveStats();
  }

  @Get(':id/publish-readiness')
  @ApiOperation({ summary: 'Check if milestone data is ready to publish' })
  getPublishReadiness(@Param('id') id: string) {
    return this.milestonesService.getPublishReadiness(id);
  }
}
```

- [ ] **Step 5: Create `milestones.module.ts`**

Create `apps/food-waste-backend/src/milestones/milestones.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      // Order schema is already defined in OrdersModule — import the model name only
      { name: 'Order', schema: null },
    ]),
  ],
  controllers: [MilestonesController],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
```

Note: The `Order` schema is registered in `OrdersModule`. Check
`apps/food-waste-backend/src/orders/orders.module.ts` and import
`MongooseModule.forFeature` from that module instead if the schema is not
globally registered. Update the import accordingly.

- [ ] **Step 6: Register in `app.module.ts`**

Open `apps/food-waste-backend/src/app.module.ts` and add:

```typescript
import { MilestonesModule } from './milestones/milestones.module';

// In the @Module imports array:
imports: [
  // ...existing modules...
  MilestonesModule,
],
```

- [ ] **Step 7: Run backend tests**

```bash
pnpm --filter @foodwaste/backend test:unit -- --testPathPattern="milestones" --no-coverage
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/food-waste-backend/src/milestones/ apps/food-waste-backend/src/app.module.ts
git commit -m "feat(backend): add MilestonesModule with live-stats and publish-readiness endpoints"
```

---

## Task 2: Frontend impact API service

**Files:** `apps/web/src/services/impact.service.ts`

- [ ] **Step 1: Create the impact service**

Create `apps/web/src/services/impact.service.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface LiveStats {
  totalBagsSaved: number;
  co2AvoidedKg: number;
  charityAmountTND: number;
}

export async function getLiveStats(): Promise<LiveStats> {
  try {
    const res = await fetch(`${API_URL}/api/v1/milestones/live-stats`, {
      next: { revalidate: 60 }, // revalidate every 60s via ISR
    });
    if (!res.ok) throw new Error('Failed to fetch live stats');
    const json = await res.json();
    return json.data ?? json;
  } catch {
    // Return zeros rather than crashing the page — counter starts at 0 honestly
    return { totalBagsSaved: 0, co2AvoidedKg: 0, charityAmountTND: 0 };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/services/impact.service.ts
git commit -m "feat(web): add impact API service with ISR revalidation and graceful fallback"
```

---

## Task 3: Impact counter component

**Files:** `apps/web/src/components/impact/impact-counter.tsx`

- [ ] **Step 1: Write component test**

Create `apps/web/src/__tests__/components/impact-counter.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { ImpactCounter } from '@/components/impact/impact-counter';

describe('ImpactCounter', () => {
  it('renders all three stat values', () => {
    render(
      <ImpactCounter
        totalBagsSaved={1250}
        co2AvoidedKg={3125}
        charityAmountTND={520}
      />
    );
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('3,125 kg')).toBeInTheDocument();
    expect(screen.getByText('520 TND')).toBeInTheDocument();
  });

  it('renders zero state without crashing', () => {
    render(
      <ImpactCounter totalBagsSaved={0} co2AvoidedKg={0} charityAmountTND={0} />
    );
    expect(screen.getAllByText('0')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="components/impact-counter" --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `impact-counter.tsx`**

Create `apps/web/src/components/impact/impact-counter.tsx`:

```typescript
interface ImpactCounterProps {
  totalBagsSaved: number;
  co2AvoidedKg: number;
  charityAmountTND: number;
}

export function ImpactCounter({ totalBagsSaved, co2AvoidedKg, charityAmountTND }: ImpactCounterProps) {
  const stats = [
    {
      value: totalBagsSaved.toLocaleString('en'),
      label: 'Bags Saved',
      icon: '🛍',
      description: 'Meals rescued from food waste',
    },
    {
      value: `${co2AvoidedKg.toLocaleString('en')} kg`,
      label: 'CO₂ Avoided',
      icon: '🌱',
      description: 'Greenhouse gas emissions prevented',
    },
    {
      value: `${charityAmountTND.toLocaleString('en')} TND`,
      label: 'Donated to Charity',
      icon: '💚',
      description: '5% of every order goes to community goals',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center text-center p-6 bg-card border border-border rounded-2xl"
        >
          <span className="text-3xl mb-3" role="img" aria-hidden>
            {stat.icon}
          </span>
          <span className="text-3xl font-bold text-foreground mb-1">{stat.value}</span>
          <span className="text-sm font-semibold text-primary mb-1">{stat.label}</span>
          <span className="text-xs text-muted-foreground">{stat.description}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @foodwaste/web test -- --testPathPattern="components/impact-counter" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/impact/ apps/web/src/__tests__/components/impact-counter.test.tsx
git commit -m "feat(web): add ImpactCounter component — renders bags saved, CO2, charity stats"
```

---

## Task 4: /impact hub page (evergreen — no data required)

**Files:** `apps/web/src/app/[locale]/(marketing)/impact/page.tsx`

- [ ] **Step 1: Create the impact hub**

Create `apps/web/src/app/[locale]/(marketing)/impact/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getLiveStats } from '@/services/impact.service';
import { ImpactCounter } from '@/components/impact/impact-counter';
import { getCanonicalUrl } from '@/config/seo.config';
import { WebPageSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import type { Locale } from '@/i18n/config';

interface ImpactHubProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ImpactHubProps): Promise<Metadata> {
  const { locale } = await params;
  const canonicalUrl = getCanonicalUrl('/impact', locale as Locale);
  return {
    title: 'Our Impact — Food Waste Saved, CO₂ Avoided, Charity Donated | Too Fresh To Waste',
    description:
      'Real-time impact data from Too Fresh To Waste. Every bag saved reduces food waste, avoids CO₂ emissions, and contributes 5% to community charity goals across Tunisia, Morocco, Algeria, UAE and Saudi Arabia.',
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: getCanonicalUrl('/impact', 'en'),
        fr: getCanonicalUrl('/impact', 'fr'),
        ar: getCanonicalUrl('/impact', 'ar'),
        'x-default': getCanonicalUrl('/impact', 'en'),
      },
    },
  };
}

export default async function ImpactHubPage({ params }: ImpactHubProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fetch live stats — returns zeros gracefully if API is unavailable
  const stats = await getLiveStats();

  const canonicalUrl = getCanonicalUrl('/impact', locale as Locale);

  const humanitarianPillars = [
    {
      icon: '🍽',
      title: 'Zero Hungry Nights',
      desc: 'Every bag saved is a meal that reaches someone who needs it. Surplus food is redirected to families facing food insecurity across the MENA region.',
    },
    {
      icon: '👴',
      title: 'Dignity for the Elderly',
      desc: 'A portion of every charity contribution supports elderly care initiatives — meals, warmth, and companionship for those most vulnerable.',
    },
    {
      icon: '📚',
      title: 'Empowering the Next Generation',
      desc: 'Education is the longest-lasting investment against poverty. Charity funds support school meals and educational materials for children in need.',
    },
    {
      icon: '🧥',
      title: 'Warmth & Care',
      desc: 'Basic needs — clothing, hygiene, warmth — matter as much as food. Charity goals include clothing drives and care packages for vulnerable communities.',
    },
  ];

  return (
    <>
      <WebPageSchema
        type="WebPage"
        name="Our Impact | Too Fresh To Waste"
        description="Real-time food waste reduction impact — bags saved, CO₂ avoided, charity donated."
        url={canonicalUrl}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'Our Impact', url: canonicalUrl },
        ]}
      />

      <main className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">Our Impact</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every surprise bag sold on Too Fresh To Waste creates a measurable impact. Here is what
            our community has achieved — updated in real time.
          </p>
        </header>

        {/* Live counter */}
        <section className="mb-16">
          <ImpactCounter
            totalBagsSaved={stats.totalBagsSaved}
            co2AvoidedKg={stats.co2AvoidedKg}
            charityAmountTND={stats.charityAmountTND}
          />
          <p className="text-center text-xs text-muted-foreground mt-4">
            Live data updated every 60 seconds. CO₂ calculation: 2.5 kg per bag (UNEP methodology).
          </p>
        </section>

        {/* 5% Charity mechanism */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-4 text-center">
            How the 5% Charity Works
          </h2>
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center max-w-xl mx-auto">
            <p className="text-4xl font-bold text-primary mb-2">5%</p>
            <p className="text-muted-foreground">
              of every order value is automatically donated to the active community charity goal. No
              action required from consumers or merchants — it happens with every purchase.
            </p>
          </div>
        </section>

        {/* 4 Humanitarian Pillars */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8 text-center">
            Our 4 Humanitarian Pillars
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {humanitarianPillars.map((pillar) => (
              <div key={pillar.title} className="flex gap-4 p-5 border border-border rounded-xl bg-card">
                <span className="text-2xl shrink-0" role="img" aria-hidden>
                  {pillar.icon}
                </span>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground">{pillar.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Monthly reports will appear here once data is available */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4">Monthly Impact Reports</h2>
          <p className="text-muted-foreground">
            Monthly reports are published once we have a full calendar month of real order data.
            Each report details bags saved, CO₂ avoided, charity goals funded, and community growth.
          </p>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/impact/page.tsx"
git commit -m "feat(web): add /impact hub page with live counter, charity mechanism, and 4 humanitarian pillars"
```

---

## Task 5: /competitions landing page (evergreen)

**Files:** `apps/web/src/app/[locale]/(marketing)/competitions/page.tsx`

- [ ] **Step 1: Create the competitions page**

Create `apps/web/src/app/[locale]/(marketing)/competitions/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getCanonicalUrl } from '@/config/seo.config';
import { WebPageSchema, BreadcrumbSchema } from '@/components/seo/schemas';
import type { Locale } from '@/i18n/config';

interface CompetitionsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CompetitionsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const canonicalUrl = getCanonicalUrl('/competitions', locale as Locale);
  return {
    title: 'Win a Smartphone or Smartwatch — Food Waste Competition | Too Fresh To Waste',
    description:
      'Every 30,000 bags saved on Too Fresh To Waste triggers a rewards competition. Top 5 consumers win smartphones, next 5 win smartwatches. Top 10 businesses win 2 free sponsor days. Max 4 competitions per year.',
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: getCanonicalUrl('/competitions', 'en'),
        fr: getCanonicalUrl('/competitions', 'fr'),
        ar: getCanonicalUrl('/competitions', 'ar'),
        'x-default': getCanonicalUrl('/competitions', 'en'),
      },
    },
  };
}

export default async function CompetitionsPage({ params }: CompetitionsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const canonicalUrl = getCanonicalUrl('/competitions', locale as Locale);

  return (
    <>
      <WebPageSchema
        type="WebPage"
        name="Rewards Competition | Too Fresh To Waste"
        description="Win smartphones and smartwatches by saving food. Every 30,000 bags triggers a competition."
        url={canonicalUrl}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'Competitions', url: canonicalUrl },
        ]}
      />

      <main className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <header className="text-center mb-16">
          <p className="text-sm text-primary font-semibold uppercase tracking-widest mb-3">
            Rewards Competition
          </p>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Save Food. Win Prizes.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every 30,000 bags saved on Too Fresh To Waste triggers a community rewards competition.
            The most active consumers and businesses win real prizes — every time.
          </p>
        </header>

        {/* How it works */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8 text-center">How It Works</h2>
          <div className="grid gap-6 sm:grid-cols-3 text-center">
            {[
              {
                step: '1',
                title: 'Save Food Bags',
                desc: 'Purchase surprise bags from local restaurants and shops. Every bag counts.',
              },
              {
                step: '2',
                title: 'Reach 30,000 Bags',
                desc: 'When the platform collectively saves 30,000 bags, a competition cycle closes.',
              },
              {
                step: '3',
                title: 'Win Prizes',
                desc: 'The leaderboard freezes. Winners are announced and prizes are distributed.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="p-6 border border-border rounded-2xl bg-card">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto mb-4">
                  {step}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Consumer prizes */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Consumer Prizes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-2 border-primary rounded-2xl p-6 bg-primary/5">
              <p className="text-3xl mb-3">📱</p>
              <h3 className="text-xl font-bold text-foreground mb-1">Rank 1–5</h3>
              <p className="text-primary font-semibold mb-2">Smartphone</p>
              <p className="text-sm text-muted-foreground">
                The top 5 consumers by bags saved each cycle win a brand-new smartphone.
              </p>
            </div>
            <div className="border border-border rounded-2xl p-6 bg-card">
              <p className="text-3xl mb-3">⌚</p>
              <h3 className="text-xl font-bold text-foreground mb-1">Rank 6–10</h3>
              <p className="text-foreground font-semibold mb-2">Smartwatch</p>
              <p className="text-sm text-muted-foreground">
                Ranks 6 through 10 each win a smartwatch.
              </p>
            </div>
          </div>
        </section>

        {/* Business prizes */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Business Prizes</h2>
          <div className="border border-border rounded-2xl p-6 bg-card">
            <p className="text-3xl mb-3">🏆</p>
            <h3 className="text-xl font-bold text-foreground mb-2">Top 10 Businesses</h3>
            <p className="text-primary font-semibold mb-3">2 Free Sponsor Days</p>
            <p className="text-sm text-muted-foreground max-w-lg">
              The top 10 merchants by bags saved each cycle receive 2 free sponsored promotion days
              on the platform — prime visibility, zero cost.
            </p>
          </div>
        </section>

        {/* Competition rules */}
        <section className="mb-16 bg-muted/50 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Competition Rules</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary shrink-0">→</span>
              Triggered automatically when the platform collectively saves 30,000 bags
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">→</span>
              Maximum 4 competitions per year (at 30,000 / 60,000 / 90,000 / 120,000 bags)
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">→</span>
              Rankings are based on bags saved within the current cycle — not lifetime total
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">→</span>
              Winners may choose to be anonymous — their name and photo only appear with explicit consent
            </li>
            <li className="flex gap-2">
              <span className="text-primary shrink-0">→</span>
              Prize delivery is arranged within 30 days of the cycle closing
            </li>
          </ul>
        </section>

        {/* Past winners (empty state — will populate after first cycle) */}
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4">Past Winners</h2>
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-dashed border-border rounded-2xl">
            <p className="text-4xl">🏁</p>
            <h3 className="text-md font-semibold">First competition coming soon</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              The first competition triggers when the platform reaches 30,000 bags saved. Start
              saving food today to be in the running.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/competitions/page.tsx"
git commit -m "feat(web): add /competitions page explaining rewards program — evergreen, no real data needed"
```

---

## Task 6: Milestone page template

**Files:** `apps/web/src/app/[locale]/(marketing)/milestones/[slug]/page.tsx`

This page only renders for slugs that correspond to real milestone MDX files in
`/content/milestones/`. No MDX file = 404. This enforces the data contract: a
milestone page only exists when someone with real data creates the MDX file
(after confirming the backend publish-readiness endpoint returns
`{ ready: true }`).

- [ ] **Step 1: Create milestone content directory**

```bash
mkdir -p content/milestones/en content/milestones/fr content/milestones/ar
echo "# Milestone MDX files go here after publish-readiness is confirmed" > content/milestones/README.md
```

- [ ] **Step 2: Create the milestone page**

Create `apps/web/src/app/[locale]/(marketing)/milestones/[slug]/page.tsx`:

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { setRequestLocale } from 'next-intl/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getCanonicalUrl } from '@/config/seo.config';
import { EventSchema, BreadcrumbSchema, WebPageSchema } from '@/components/seo/schemas';
import { ImpactCounter } from '@/components/impact/impact-counter';
import type { Locale } from '@/i18n/config';

interface MilestoneFrontmatter {
  title: string;
  description: string;
  milestoneId: string;      // e.g. "30000"
  totalBagsSaved: number;
  co2AvoidedKg: number;
  charityAmountTND: number;
  milestoneDate: string;    // ISO date when milestone was hit
  publishedAt: string;
  locale: Locale;
}

const MILESTONES_DIR = path.join(process.cwd(), 'content', 'milestones');

function getMilestone(locale: string, slug: string) {
  const filePath = path.join(MILESTONES_DIR, locale, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  return { frontmatter: parsed.data as MilestoneFrontmatter, content: parsed.content };
}

function getAllMilestoneSlugs(locale: string): string[] {
  const dir = path.join(MILESTONES_DIR, locale);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.mdx')).map(f => f.replace(/\.mdx$/, ''));
}

interface MilestonePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return getAllMilestoneSlugs(locale).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: MilestonePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const milestone = getMilestone(locale, slug);
  if (!milestone) return {};
  const { frontmatter } = milestone;
  const canonicalUrl = getCanonicalUrl(`/milestones/${slug}`, locale as Locale);
  return {
    title: `${frontmatter.title} | Too Fresh To Waste`,
    description: frontmatter.description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: getCanonicalUrl(`/milestones/${slug}`, 'en'),
        fr: getCanonicalUrl(`/milestones/${slug}`, 'fr'),
        ar: getCanonicalUrl(`/milestones/${slug}`, 'ar'),
        'x-default': getCanonicalUrl(`/milestones/${slug}`, 'en'),
      },
    },
  };
}

export default async function MilestonePage({ params }: MilestonePageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const milestone = getMilestone(locale, slug);
  if (!milestone) notFound();

  const { frontmatter, content } = milestone;
  const canonicalUrl = getCanonicalUrl(`/milestones/${slug}`, locale as Locale);

  return (
    <>
      <EventSchema
        name={frontmatter.title}
        description={frontmatter.description}
        startDate={frontmatter.milestoneDate}
        url={canonicalUrl}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: getCanonicalUrl('/', locale as Locale) },
          { name: 'Impact', url: getCanonicalUrl('/impact', locale as Locale) },
          { name: frontmatter.title, url: canonicalUrl },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6">
        <header className="text-center mb-12">
          <p className="text-sm text-primary font-semibold uppercase tracking-widest mb-3">
            Milestone Reached
          </p>
          <h1 className="text-4xl font-bold text-foreground mb-4">{frontmatter.title}</h1>
          <p className="text-lg text-muted-foreground">{frontmatter.description}</p>
          <time className="text-sm text-muted-foreground mt-2 block" dateTime={frontmatter.milestoneDate}>
            {new Date(frontmatter.milestoneDate).toLocaleDateString(locale, {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </time>
        </header>

        <section className="mb-12">
          <ImpactCounter
            totalBagsSaved={frontmatter.totalBagsSaved}
            co2AvoidedKg={frontmatter.co2AvoidedKg}
            charityAmountTND={frontmatter.charityAmountTND}
          />
        </section>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <MDXRemote source={content} />
        </article>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/[locale]/(marketing)/milestones/" content/milestones/
git commit -m "feat(web): add milestone page template — renders only when MDX file with verified data exists"
```

---

## Task 7: Update sitemap with impact/competition/milestone pages

**Files:** `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Add evergreen pages to sitemap**

In `apps/web/src/app/sitemap.ts`, add to the `marketingPages` array:

```typescript
{ path: '/impact', changeFrequency: 'weekly' as const, priority: PRIORITY.milestone },
{ path: '/competitions', changeFrequency: 'monthly' as const, priority: PRIORITY.marketing },
```

Milestone pages are added dynamically — append after the country pages section
in `sitemap()`:

```typescript
// Milestone pages (only published ones, based on MDX files)
const { locales: blogLocales } = await import('@/i18n/config');
const milestonesDir = path.join(process.cwd(), 'content', 'milestones', 'en');
if (fs.existsSync(milestonesDir)) {
  const milestoneSlugs = fs
    .readdirSync(milestonesDir)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
  milestoneSlugs.forEach(slug => {
    locales.forEach((locale: Locale) => {
      entries.push(
        buildEntry(
          `/milestones/${slug}`,
          'monthly',
          PRIORITY.milestone,
          locale,
          now,
        ),
      );
    });
  });
}
```

Note: `sitemap.ts` must import `fs` and `path` if not already imported. Since
`sitemap.ts` runs on the server at build time, these Node.js APIs are available.

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @foodwaste/web type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/sitemap.ts
git commit -m "feat(seo): add /impact and /competitions to sitemap; auto-discover published milestone pages"
```

---

## Verification

After all tasks complete:

1. `pnpm --filter @foodwaste/backend build` — backend compiles
2. `pnpm --filter @foodwaste/backend test:unit -- --no-coverage` — milestone
   tests pass
3. `pnpm --filter @foodwaste/web build` — web builds cleanly
4. `pnpm --filter @foodwaste/web test -- --no-coverage` — all web tests pass
5. Start both servers: `pnpm dev`
6. Visit `http://localhost:3001/en/impact` — hub renders with ImpactCounter
   showing 0s initially
7. Visit `http://localhost:3001/en/competitions` — full page with prize tiers,
   rules, empty past winners
8. Visit `http://localhost:3000/api/v1/milestones/live-stats` — returns
   `{ totalBagsSaved: 0, co2AvoidedKg: 0, charityAmountTND: 0 }`
9. Visit `http://localhost:3000/api/v1/milestones/30000/publish-readiness` —
   returns
   `{ ready: false, reason: "Platform has saved 0 bags — milestone requires 30000 bags" }`
10. Visit `http://localhost:3001/en/milestones/any-slug` — returns 404 (no MDX
    files yet — correct)

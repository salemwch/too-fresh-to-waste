/**
 * Visual-regression harness.
 *
 * Renders every shared primitive in each variant, size and state on one page so
 * Playwright can screenshot them in isolation. Real product routes cannot do
 * this: a Button's disabled state or a Select's open menu appears on no single
 * page, and the states that do appear are tangled up with live data.
 *
 * This route is **never available in production**. It is gated on
 * NEXT_PUBLIC_VISUAL_HARNESS, set only by the Playwright webServer
 * command, and returns a 404 otherwise.
 *
 * Everything here is deterministic by construction: no dates, no randomness, no
 * network, no locale lookups. Copy is hardcoded English plus one fixed Arabic
 * sample, because the point is component geometry and direction, not
 * translation content.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { locales, type Locale } from '@/i18n/config';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { VisualHarnessClient } from './harness-client';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

/** Never indexed, never linked. Belt and braces alongside the 404 gate. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Visual harness',
};

const ARABIC_SAMPLE = 'حفظ الطعام من الهدر';

function Section({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: React.ReactNode }>) {
  return (
    <section data-visual={id} className='space-y-md border-b border-border pb-xl'>
      <h2 className='font-heading text-2xl font-semibold'>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className='flex flex-wrap items-center gap-md'>
      <span className='w-32 shrink-0 text-sm text-muted-foreground'>{label}</span>
      {children}
    </div>
  );
}

export default async function VisualHarnessPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  if (process.env.NEXT_PUBLIC_VISUAL_HARNESS !== '1') notFound();

  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale as Locale);

  return (
    <main className='mx-auto max-w-5xl space-y-xl p-lg' data-visual-root>
      <h1 className='font-heading text-3xl font-bold'>Visual harness</h1>

      <Section id='button' title='Button'>
        <Row label='variants'>
          <Button>Default</Button>
          <Button variant='secondary'>Secondary</Button>
          <Button variant='outline'>Outline</Button>
          <Button variant='ghost'>Ghost</Button>
          <Button variant='link'>Link</Button>
          <Button variant='destructive'>Destructive</Button>
        </Row>
        <Row label='sizes'>
          <Button size='sm'>Small</Button>
          <Button>Default</Button>
          <Button size='lg'>Large</Button>
          <Button size='icon' aria-label='Icon button'>
            <span aria-hidden>+</span>
          </Button>
        </Row>
        <Row label='states'>
          <Button disabled>Disabled</Button>
          <Button variant='outline' disabled>
            Disabled outline
          </Button>
          {/* 19-E31 checks hover, focus and disabled on the destructive
              variant; the disabled one had no representative here. */}
          <Button variant='destructive' disabled data-visual-destructive-disabled>
            Disabled destructive
          </Button>
        </Row>
        <Row label='arabic'>
          <Button>{ARABIC_SAMPLE}</Button>
          <Button variant='outline'>{ARABIC_SAMPLE}</Button>
        </Row>
      </Section>

      <Section id='form' title='Form controls'>
        <div className='grid gap-md sm:grid-cols-2'>
          <div className='space-y-sm'>
            <Label htmlFor='vh-input'>Input</Label>
            <Input id='vh-input' placeholder='Placeholder text' />
          </div>
          <div className='space-y-sm'>
            <Label htmlFor='vh-input-filled'>Input, filled</Label>
            <Input id='vh-input-filled' defaultValue='Le Fournil du Lac' readOnly />
          </div>
          <div className='space-y-sm'>
            <Label htmlFor='vh-input-disabled'>Input, disabled</Label>
            <Input id='vh-input-disabled' placeholder='Disabled' disabled />
          </div>
          <div className='space-y-sm'>
            <Label htmlFor='vh-input-ar'>Input, Arabic</Label>
            <Input id='vh-input-ar' defaultValue={ARABIC_SAMPLE} readOnly />
          </div>
          <div className='space-y-sm sm:col-span-2'>
            <Label htmlFor='vh-textarea'>Textarea</Label>
            <Textarea id='vh-textarea' placeholder='Tell merchants what is in the bag' />
          </div>
        </div>
      </Section>

      <Section id='card' title='Card'>
        <div className='grid gap-md sm:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Surprise bag</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-base text-muted-foreground'>
                Collect between 18:00 and 19:00. Worth at least 3x the price.
              </p>
              <p className='mt-md text-xl font-bold tabular-nums'>7.90 TND</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
            </CardHeader>
            <CardContent className='space-y-sm'>
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-2/3' />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id='badge' title='Badge and status'>
        <Row label='variants'>
          <Badge>Default</Badge>
          <Badge variant='secondary'>Secondary</Badge>
          <Badge variant='outline'>Outline</Badge>
          <Badge variant='destructive'>Destructive</Badge>
        </Row>
        <Row label='order status'>
          <Badge className='bg-warning text-foreground'>PENDING</Badge>
          <Badge className='bg-info text-foreground'>RESERVED</Badge>
          <Badge className='bg-primary text-primary-foreground'>CONFIRMED</Badge>
          <Badge className='bg-success text-white'>PICKED UP</Badge>
          <Badge className='bg-error text-white'>CANCELLED</Badge>
          <Badge className='bg-muted text-muted-foreground'>EXPIRED</Badge>
        </Row>
      </Section>

      <Section id='alert' title='Alert'>
        {/* AlertTitle is defined in alert.tsx but not exported, so it is not
            part of the public API and is not covered here. See the harness
            README. */}
        <Alert>
          <AlertDescription>Your pickup window closes in 30 minutes.</AlertDescription>
        </Alert>
        <Alert variant='destructive'>
          <AlertDescription>The card was declined. Try another payment method.</AlertDescription>
        </Alert>
      </Section>

      <Section id='separator' title='Separator'>
        <div className='space-y-md'>
          <p className='text-base'>Above</p>
          <Separator />
          <p className='text-base'>Below</p>
        </div>
      </Section>

      {/* Select, Dialog and Tabs need client state to show their open/active views. */}
      <VisualHarnessClient arabicSample={ARABIC_SAMPLE} />
    </main>
  );
}

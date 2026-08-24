'use client';

/**
 * The parts of the harness that need client state.
 *
 * Select, Dialog and Tabs only show their interesting surface - open menu, open
 * modal, active panel - once something has interacted with them. Playwright
 * drives that via the stable `data-visual-*` hooks below rather than by
 * guessing at Radix's internal markup.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function VisualHarnessClient({ arabicSample }: Readonly<{ arabicSample: string }>) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <section data-visual='select' className='space-y-md border-b border-border pb-xl'>
        <h2 className='font-heading text-2xl font-semibold'>Select</h2>
        <div className='grid gap-md sm:grid-cols-2'>
          <div className='space-y-sm'>
            <Label htmlFor='vh-select'>Closed</Label>
            <Select>
              <SelectTrigger id='vh-select' data-visual-select>
                <SelectValue placeholder='Choose a category' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='bakery'>Bakery</SelectItem>
                <SelectItem value='grocery'>Grocery</SelectItem>
                <SelectItem value='prepared'>Prepared meals</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-sm'>
            <Label htmlFor='vh-select-disabled'>Disabled</Label>
            <Select disabled>
              <SelectTrigger id='vh-select-disabled'>
                <SelectValue placeholder='Unavailable' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section data-visual='tabs' className='space-y-md border-b border-border pb-xl'>
        <h2 className='font-heading text-2xl font-semibold'>Tabs</h2>
        <Tabs defaultValue='today'>
          <TabsList>
            <TabsTrigger value='today'>Today</TabsTrigger>
            <TabsTrigger value='upcoming'>Upcoming</TabsTrigger>
            <TabsTrigger value='past'>Past</TabsTrigger>
          </TabsList>
          <TabsContent value='today' className='pt-md text-base'>
            Four bags left to collect today.
          </TabsContent>
          <TabsContent value='upcoming' className='pt-md text-base'>
            Nothing scheduled yet.
          </TabsContent>
          <TabsContent value='past' className='pt-md text-base'>
            {arabicSample}
          </TabsContent>
        </Tabs>
      </section>

      <section data-visual='dialog' className='space-y-md pb-xl'>
        <h2 className='font-heading text-2xl font-semibold'>Dialog</h2>
        <Button data-visual-dialog-trigger onClick={() => setDialogOpen(true)}>
          Open dialog
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent data-visual-dialog>
            <DialogHeader>
              <DialogTitle>Cancel this order?</DialogTitle>
              <DialogDescription>
                The bag goes back on sale immediately and the customer is refunded in full.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant='outline' onClick={() => setDialogOpen(false)}>
                Keep it
              </Button>
              <Button variant='destructive'>Cancel order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </>
  );
}

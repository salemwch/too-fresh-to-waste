'use client';

import { Button } from '@foodwaste/ui';
import { useTranslations } from 'next-intl';
import { Input } from '@foodwaste/ui';
import { Label } from '@foodwaste/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PrizeCategory } from '@foodwaste/shared';
import { Trash2, Plus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrizeFormItem {
  name: string;
  description: string;
  imageUrl?: string;
  category: string;
  value: string;
}

interface PrizeBuilderProps {
  prizes: PrizeFormItem[];
  onChange: (prizes: PrizeFormItem[]) => void;
  disabled?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = Object.values(PrizeCategory);

/**
 * Starting values for the prize form.
 *
 * Deliberately NOT translated. These are seed *content*, not chrome: the admin
 * edits them and they are then persisted and shown to every user, whatever
 * language that user reads. Translating the seed would make the stored prize
 * name depend on which language the admin happened to have selected, so a
 * French admin's cycle would ship French prize names to Arabic customers.
 */
export const DEFAULT_PRIZES: PrizeFormItem[] = [
  {
    name: 'Latest Smartphone',
    description: 'Brand new flagship phone',
    imageUrl: '',
    category: PrizeCategory.PHONE,
    value: '1000 DT',
  },
  {
    name: '5-Day Hotel Stay',
    description: 'Luxury hotel vacation',
    imageUrl: '',
    category: PrizeCategory.HOTEL_STAY,
    value: '5 days',
  },
  {
    name: 'Shopping Voucher',
    description: '1000 DT shopping spree',
    imageUrl: '',
    category: PrizeCategory.SHOPPING_VOUCHER,
    value: '1000 DT',
  },
  {
    name: 'VIP Gym + Protein',
    description: '1-year premium gym membership',
    imageUrl: '',
    category: PrizeCategory.GYM_MEMBERSHIP,
    value: '1 year',
  },
  {
    name: 'Electric Scooter',
    description: 'Eco-friendly transport',
    imageUrl: '',
    category: PrizeCategory.ELECTRIC_SCOOTER,
    value: '2000 DT',
  },
];

const EMPTY_PRIZE: PrizeFormItem = {
  name: '',
  description: '',
  imageUrl: '',
  category: PrizeCategory.CUSTOM,
  value: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PrizeBuilder({ prizes, onChange, disabled }: PrizeBuilderProps) {
  const t = useTranslations('adminVoting.prizes');
  function updatePrize(index: number, field: keyof PrizeFormItem, value: string) {
    const updated = [...prizes];
    updated[index] = { ...updated[index]!, [field]: value };
    onChange(updated);
  }

  function addPrize() {
    onChange([...prizes, { ...EMPTY_PRIZE }]);
  }

  function removePrize(index: number) {
    onChange(prizes.filter((_, i) => i !== index));
  }

  return (
    <div className='space-y-md'>
      <Label className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
        {t('sectionLabel', { count: prizes.length })}
      </Label>

      {prizes.map((prize, index) => (
        <div key={index} className='rounded-lg border border-border/60 bg-muted/10 p-lg space-y-md'>
          {/* Prize header */}
          <div className='flex items-center justify-between'>
            <span className='text-xs font-semibold text-muted-foreground'>Prize {index + 1}</span>
            {!disabled && prizes.length > 2 && (
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='w-6 p-0 border-destructive/30 text-destructive hover:bg-destructive/5'
                onClick={() => removePrize(index)}
                aria-label={t('remove', { number: index + 1 })}
              >
                <Trash2 className='size-3' />
              </Button>
            )}
          </div>

          {/* Fields grid */}
          <div className='grid grid-cols-2 gap-md'>
            <div className='space-y-xs'>
              <Label className='text-xs'>{t('name')} *</Label>
              <Input
                value={prize.name}
                onChange={e => updatePrize(index, 'name', e.target.value)}
                disabled={disabled}
                placeholder={t('namePlaceholder')}
                required
                className='h-7 text-xs'
              />
            </div>

            <div className='space-y-xs'>
              <Label className='text-xs'>{t('value')}</Label>
              <Input
                value={prize.value}
                onChange={e => updatePrize(index, 'value', e.target.value)}
                disabled={disabled}
                placeholder={t('valuePlaceholder')}
                className='h-7 text-xs'
              />
            </div>

            <div className='col-span-2 space-y-xs'>
              <Label className='text-xs'>{t('description')}</Label>
              <Input
                value={prize.description}
                onChange={e => updatePrize(index, 'description', e.target.value)}
                disabled={disabled}
                placeholder={t('descriptionPlaceholder')}
                className='h-7 text-xs'
              />
            </div>

            <div className='space-y-xs'>
              <Label className='text-xs'>{t('category')}</Label>
              <Select
                value={prize.category}
                onValueChange={val => updatePrize(index, 'category', val)}
                {...(disabled ? { disabled: true } : {})}
              >
                <SelectTrigger className='h-7 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className='text-xs'>
                      {t(`categories.${cat.toLowerCase()}` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-xs'>
              <Label className='text-xs'>{t('imageUrl')}</Label>
              <Input
                value={prize.imageUrl}
                onChange={e => updatePrize(index, 'imageUrl', e.target.value)}
                disabled={disabled}
                placeholder={t('imageUrlPlaceholder')}
                className='h-7 text-xs'
              />
            </div>
          </div>
        </div>
      ))}

      {!disabled && prizes.length < 10 && (
        <Button
          type='button'
          variant='outline'
          onClick={addPrize}
          className='w-full text-xs border-dashed'
        >
          <Plus className='size-3.5 me-1.5' />
          {t('addPrize')}
        </Button>
      )}
    </div>
  );
}

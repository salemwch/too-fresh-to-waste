'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Truck, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrivers, useCreateDriver } from '@/hooks/use-drivers';
import type { CreateDriverResponse } from '@/services/admin.service';

// ── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phoneNumber: z
    .string()
    .transform(v => v.replace(/\s+/g, ''))
    .pipe(z.string().min(8, 'Invalid phone')),
  idCardNumber: z
    .string()
    .length(8, '8 digits required')
    .regex(/^\d{8}$/, 'Digits only'),
  address: z.string().min(1, 'Required'),
});

type FormFields = keyof z.infer<typeof schema>;

const EMPTY: Record<FormFields, string> = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  idCardNumber: '',
  address: '',
};

// ── Field config — 3-col rows ─────────────────────────────────────────────────

const ROWS: { name: FormFields; label: string; placeholder?: string }[][] = [
  [
    { name: 'firstName', label: 'First Name', placeholder: 'Ali' },
    { name: 'lastName', label: 'Last Name', placeholder: 'Ben Salem' },
    { name: 'email', label: 'Email', placeholder: 'driver@example.com' },
  ],
  [
    { name: 'phoneNumber', label: 'Phone', placeholder: '+216 XX XXX XXX' },
    { name: 'idCardNumber', label: 'CIN', placeholder: '12345678' },
    { name: 'address', label: 'Address', placeholder: 'Tunis, Tunisia' },
  ],
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers();
  const { mutateAsync: createDriver, isPending } = useCreateDriver();

  const [values, setValues] = useState<Record<FormFields, string>>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FormFields, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateDriverResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (name: FormFields, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs: Partial<Record<FormFields, string>> = {};
      for (const issue of parsed.error.issues) {
        const f = issue.path[0] as FormFields;
        if (f && !errs[f]) errs[f] = issue.message;
      }
      setErrors(errs);
      return;
    }
    try {
      setCreated(await createDriver(parsed.data));
      setValues(EMPTY);
      setErrors({});
    } catch (err) {
      setSubmitError('Failed to create driver. Please try again.');
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-2'>
        <Truck className='size-5 text-primary' />
        <h1 className='text-xl font-semibold text-primary'>Driver Accounts</h1>
      </div>

      {/* Create form — compact card */}
      <section className='bg-card rounded-lg border p-4'>
        <h2 className='text-sm font-semibold mb-3 text-foreground'>Create Driver Account</h2>
        <form onSubmit={handleSubmit} className='space-y-3'>
          {ROWS.map((row, ri) => (
            <div key={ri} className='grid grid-cols-3 gap-3'>
              {row.map(({ name, label, placeholder }) => (
                <div key={name} className='space-y-1'>
                  <Label htmlFor={name} className='text-xs text-muted-foreground'>
                    {label}
                  </Label>
                  <Input
                    id={name}
                    placeholder={placeholder}
                    value={values[name]}
                    onChange={e => handleChange(name, e.target.value)}
                    className='h-8 text-sm'
                  />
                  {errors[name] && (
                    <p className='text-destructive text-[11px] leading-tight'>{errors[name]}</p>
                  )}
                </div>
              ))}
            </div>
          ))}

          {submitError && <p className='text-destructive text-xs'>{submitError}</p>}

          <div className='flex justify-end pt-1'>
            <Button type='submit' size='sm' disabled={isPending} className='min-w-[140px]'>
              {isPending ? 'Creating…' : 'Create Driver'}
            </Button>
          </div>
        </form>
      </section>

      {/* Drivers table */}
      <section className='bg-card rounded-lg border overflow-hidden'>
        <div className='px-4 py-3 border-b bg-muted/30'>
          <h2 className='text-sm font-semibold'>
            All Drivers
            {!isLoading && (
              <span className='ms-2 text-xs font-normal text-muted-foreground'>
                ({drivers.length})
              </span>
            )}
          </h2>
        </div>
        <table className='w-full text-sm'>
          <thead className='border-b bg-muted/20'>
            <tr>
              {['Name', 'Email', 'Phone', 'CIN', 'Address', 'Status', 'Joined'].map(h => (
                <th
                  key={h}
                  className='text-left px-3 py-2 text-xs font-medium text-muted-foreground'
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className='border-b last:border-0'>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className='px-3 py-2'>
                      <Skeleton className='h-4 w-full' />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && drivers.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className='flex flex-col items-center justify-center py-10 gap-2 text-center'>
                    <Truck className='size-8 text-muted-foreground/40' />
                    <p className='text-sm text-muted-foreground'>No drivers yet</p>
                  </div>
                </td>
              </tr>
            )}
            {drivers.map(d => (
              <tr
                key={d._id}
                className='border-b last:border-0 hover:bg-muted/20 transition-colors'
              >
                <td className='px-3 py-2 font-medium text-sm'>
                  {d.firstName} {d.lastName}
                </td>
                <td className='px-3 py-2 text-xs text-muted-foreground'>{d.email}</td>
                <td className='px-3 py-2 text-xs text-muted-foreground'>{d.phoneNumber ?? '—'}</td>
                <td className='px-3 py-2 font-mono text-xs'>
                  {d.driverProfile?.idCardNumber ?? '—'}
                </td>
                <td className='px-3 py-2 text-xs text-muted-foreground max-w-[140px] truncate'>
                  {d.driverProfile?.address ?? '—'}
                </td>
                <td className='px-3 py-2'>
                  {d.requiresPasswordChange ? (
                    <Badge
                      variant='outline'
                      className='text-[10px] border-warning text-warning bg-warning/10 py-0'
                    >
                      Pending Setup
                    </Badge>
                  ) : (
                    <Badge
                      variant='outline'
                      className='text-[10px] border-success text-success bg-success/10 py-0'
                    >
                      Active
                    </Badge>
                  )}
                </td>
                <td className='px-3 py-2 text-xs text-muted-foreground'>
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Temp password modal — non-dismissible */}
      <Dialog open={!!created} onOpenChange={() => {}}>
        <DialogContent
          onInteractOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Truck className='size-4' />
              Driver Account Created
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              Share this temporary password with the driver. It will{' '}
              <span className='font-semibold text-destructive'>never be shown again</span>.
            </p>
            <div className='flex items-center gap-2 bg-muted rounded-md px-3 py-2'>
              <code className='flex-1 text-sm font-mono font-bold tracking-widest'>
                {created?.temporaryPassword}
              </code>
              <Button size='icon' variant='ghost' className='h-7 w-7 shrink-0' onClick={handleCopy}>
                {copied ? (
                  <Check className='size-3.5 text-success' />
                ) : (
                  <Copy className='size-3.5' />
                )}
              </Button>
            </div>
            <Button className='w-full' size='sm' onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

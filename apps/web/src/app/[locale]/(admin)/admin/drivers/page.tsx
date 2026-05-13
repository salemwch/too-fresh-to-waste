'use client';

import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDrivers, useCreateDriver } from '@/hooks/use-drivers';
import type { CreateDriverResponse } from '@/services/admin.service';

// ── Validation schema ────────────────────────────────────────────────────────

const createDriverSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phoneNumber: z
    .string()
    .transform(v => v.replace(/\s+/g, ''))
    .pipe(z.string().min(8, 'Invalid phone number')),
  idCardNumber: z
    .string()
    .length(8, 'CIN must be exactly 8 digits')
    .regex(/^\d{8}$/, 'CIN must contain only digits'),
  address: z.string().min(1, 'Required'),
});

type CreateDriverForm = z.infer<typeof createDriverSchema>;
type FormFields = keyof CreateDriverForm;

const FIELDS: { name: FormFields; label: string }[] = [
  { name: 'firstName', label: 'First Name' },
  { name: 'lastName', label: 'Last Name' },
  { name: 'email', label: 'Email' },
  { name: 'phoneNumber', label: 'Phone Number' },
  { name: 'idCardNumber', label: 'CIN (8 digits)' },
  { name: 'address', label: 'Address' },
];

const EMPTY_FORM: Record<FormFields, string> = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  idCardNumber: '',
  address: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const { data: drivers = [], isLoading } = useDrivers();
  const { mutateAsync: createDriver, isPending } = useCreateDriver();

  const [formValues, setFormValues] = useState<Record<FormFields, string>>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormFields, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [createdResult, setCreatedResult] = useState<CreateDriverResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (name: FormFields, value: string) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
    // Clear field error on change
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const parsed = createDriverSchema.safeParse(formValues);
    if (!parsed.success) {
      const errs: Partial<Record<FormFields, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FormFields;
        if (field && !errs[field]) errs[field] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    try {
      const result = await createDriver(parsed.data);
      setCreatedResult(result);
      setFormValues(EMPTY_FORM);
      setFieldErrors({});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create driver. Please try again.';
      setSubmitError(msg);
    }
  };

  const handleCopy = async () => {
    if (!createdResult) return;
    await navigator.clipboard.writeText(createdResult.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className='p-6 space-y-8'>
      <h1 className='text-2xl font-bold text-primary'>Driver Accounts</h1>

      {/* Create Driver Form */}
      <section className='bg-card rounded-xl border p-6 space-y-4'>
        <h2 className='text-lg font-semibold'>Create Driver Account</h2>
        <form onSubmit={handleSubmit} className='grid grid-cols-2 gap-4'>
          {FIELDS.map(({ name, label }) => (
            <div key={name} className='space-y-1'>
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                value={formValues[name]}
                onChange={e => handleChange(name, e.target.value)}
              />
              {fieldErrors[name] && <p className='text-destructive text-xs'>{fieldErrors[name]}</p>}
            </div>
          ))}
          {submitError && <p className='col-span-2 text-destructive text-sm'>{submitError}</p>}
          <div className='col-span-2'>
            <Button type='submit' disabled={isPending} className='w-full'>
              {isPending ? 'Creating…' : 'Create Driver Account'}
            </Button>
          </div>
        </form>
      </section>

      {/* Drivers Table */}
      <section className='bg-card rounded-xl border'>
        <table className='w-full text-sm'>
          <thead className='border-b bg-muted/50'>
            <tr>
              {['Name', 'Email', 'Phone', 'CIN', 'Address', 'Status', 'Created'].map(h => (
                <th key={h} className='text-left px-4 py-3 font-medium text-muted-foreground'>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className='text-center py-8 text-muted-foreground'>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && drivers.length === 0 && (
              <tr>
                <td colSpan={7} className='text-center py-8 text-muted-foreground'>
                  No drivers yet.
                </td>
              </tr>
            )}
            {drivers.map(d => (
              <tr key={d._id} className='border-b last:border-0 hover:bg-muted/30'>
                <td className='px-4 py-3 font-medium'>
                  {d.firstName} {d.lastName}
                </td>
                <td className='px-4 py-3 text-muted-foreground'>{d.email}</td>
                <td className='px-4 py-3 text-muted-foreground'>{d.phoneNumber ?? '—'}</td>
                <td className='px-4 py-3 font-mono text-xs'>
                  {d.driverProfile?.idCardNumber ?? '—'}
                </td>
                <td className='px-4 py-3 text-muted-foreground max-w-[160px] truncate'>
                  {d.driverProfile?.address ?? '—'}
                </td>
                <td className='px-4 py-3'>
                  {d.requiresPasswordChange ? (
                    <Badge
                      variant='outline'
                      className='border-yellow-400 text-yellow-600 bg-yellow-50'
                    >
                      Pending Setup
                    </Badge>
                  ) : (
                    <Badge
                      variant='outline'
                      className='border-green-500 text-green-700 bg-green-50'
                    >
                      Active
                    </Badge>
                  )}
                </td>
                <td className='px-4 py-3 text-muted-foreground'>
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Temporary Password Modal — never auto-dismisses */}
      <Dialog open={!!createdResult} onOpenChange={(_open: boolean) => {}}>
        <DialogContent
          onInteractOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Driver Account Created</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              Share this temporary password with the driver. It will{' '}
              <span className='font-semibold text-destructive'>never be shown again</span>.
            </p>
            <div className='flex items-center gap-3 bg-muted rounded-lg p-4'>
              <code className='flex-1 text-sm font-mono font-bold tracking-wider'>
                {createdResult?.temporaryPassword}
              </code>
              <Button size='sm' variant='outline' onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Button className='w-full' onClick={() => setCreatedResult(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

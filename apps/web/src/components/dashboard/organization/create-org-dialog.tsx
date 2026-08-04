'use client';

import { useState } from 'react';
import { Building2, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateOrganization } from '@/hooks/use-organization';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';

interface CreateOrgDialogProps {
  trigger: React.ReactNode;
}

export function CreateOrgDialog({ trigger }: CreateOrgDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: establishment } = useMyEstablishment();
  const createOrg = useCreateOrganization();

  const establishmentId = establishment?._id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || name.trim().length < 2) {
      setError('Organization name must be at least 2 characters');
      return;
    }

    if (!establishmentId) {
      setError('No establishment found. Complete your establishment profile first.');
      return;
    }

    try {
      await createOrg.mutateAsync({ name: name.trim(), establishmentId });
      setSuccess(true);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
      const message =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw)
            ? (raw as unknown[])
                .map(item => (typeof item === 'string' ? item : 'Validation error'))
                .join(' ')
            : 'Failed to create organization. Please try again.';
      setError(message);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setName('');
      setError('');
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        {success ? (
          <div className='flex flex-col items-center py-6 gap-3 text-center'>
            <CheckCircle2 className='size-12 text-success' />
            <h3 className='text-lg font-semibold'>Organization Created</h3>
            <p className='text-sm text-muted-foreground max-w-xs'>
              Your organization is pending admin approval. Once approved, you can add more locations
              and invite location managers.
            </p>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <Building2 className='size-5' />
                Create Organization
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <label htmlFor='orgName' className='text-sm font-medium'>
                  Organization Name
                </label>
                {/*
                  No autoFocus: Radix Dialog already moves focus into the
                  content when it opens, so this was redundant, and an
                  unannounced focus jump is disorienting with a screen reader.
                */}
                <input
                  id='orgName'
                  type='text'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder='e.g. Movenpick Tunisia'
                  className='w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30'
                  required
                  minLength={2}
                  maxLength={100}
                />
                <p className='text-xs text-muted-foreground'>
                  The brand or company name that groups your locations.
                </p>
              </div>

              {establishment && (
                <div className='rounded-md bg-muted/50 p-3 text-sm'>
                  <p className='text-muted-foreground'>
                    Your current establishment will be the first location:
                  </p>
                  <p className='font-medium mt-1'>{establishment.name}</p>
                </div>
              )}

              {!establishment && (
                <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive'>
                  You need at least one establishment before creating an organization. Complete your
                  establishment profile first.
                </div>
              )}

              {error && (
                <div className='rounded-md bg-destructive/10 p-3 text-sm text-destructive break-words overflow-hidden'>
                  {error}
                </div>
              )}

              <Button
                type='submit'
                className='w-full'
                disabled={createOrg.isPending || !establishmentId}
              >
                {createOrg.isPending && <Loader2 className='size-4 me-2 animate-spin' />}
                Create Organization
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

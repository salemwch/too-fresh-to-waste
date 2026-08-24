'use client';

import { useState } from 'react';
import { Mail, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInviteMember } from '@/hooks/use-organization';
import type { MyEstablishment } from '@/types/dashboard';

interface InviteMemberDialogProps {
  orgId: string;
  establishments: MyEstablishment[];
  trigger: React.ReactNode;
}

export function InviteMemberDialog({ orgId, establishments, trigger }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [establishmentId, setEstablishmentId] = useState('');
  const invite = useInviteMember(orgId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !establishmentId) return;

    await invite.mutateAsync({ email, assignedEstablishmentId: establishmentId });
    setEmail('');
    setEstablishmentId('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Invite Location Manager</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-lg'>
          <div className='space-y-sm'>
            <label htmlFor='inviteEmail' className='text-sm font-medium'>
              Email
            </label>
            <div className='relative'>
              <Mail className='absolute start-md top-xs/2 -translate-y-xs/2 size-4 text-muted-foreground' />
              <input
                id='inviteEmail'
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder='receptionist@hotel.tn'
                className='w-full ps-6xl pe-md py-sm border rounded-md text-sm'
                required
              />
            </div>
          </div>

          <div className='space-y-sm'>
            <label htmlFor='assignLocation' className='text-sm font-medium'>
              Assign to Location
            </label>
            <Select value={establishmentId} onValueChange={setEstablishmentId}>
              <SelectTrigger id='assignLocation'>
                <SelectValue placeholder='Select a location' />
              </SelectTrigger>
              <SelectContent>
                {establishments.map(est => (
                  <SelectItem key={est._id} value={est._id}>
                    <div className='flex items-center gap-sm'>
                      <MapPin className='size-3' />
                      {est.name} — {est.address?.city}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type='submit' className='w-full' disabled={invite.isPending}>
            {invite.isPending && <Loader2 className='size-4 me-sm animate-spin' />}
            Send Invitation
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

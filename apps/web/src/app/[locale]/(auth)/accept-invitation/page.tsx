'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  organizationService,
  type InvitationVerifyResponse,
} from '@/services/organization.service';

type PageState = 'loading' | 'form' | 'success' | 'error';

// ── Inner component (uses useSearchParams — must live inside Suspense) ────────
function AcceptInvitationInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  /*
   * A missing token is decided here, not by an effect. There is nothing to
   * fetch, so the page is already in its final state and the loading spinner
   * that the effect version painted for one frame was never going to resolve.
   * The effect below now only does the async verification.
   */
  const [state, setState] = useState<PageState>(token ? 'loading' : 'error');
  const [invitation, setInvitation] = useState<InvitationVerifyResponse | null>(null);
  const [error, setError] = useState(token ? '' : 'No invitation token provided');
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (!token) return;

    organizationService
      .verifyInvitation(token)
      .then(res => {
        setInvitation(res.data.data);
        setState('form');
      })
      .catch((err: unknown) => {
        setError(
          (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Invalid or expired invitation',
        );
        setState('error');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      await organizationService.acceptInvitation({
        token,
        firstName,
        lastName,
        password,
        ...(phoneNumber ? { phoneNumber } : {}),
      });
      setState('success');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Failed to accept invitation';
      setError(message);
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className='flex justify-center py-4xl'>
        <Loader2 className='size-8 animate-spin text-primary' />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <Card>
        <CardContent className='flex flex-col items-center py-6xl gap-md text-center'>
          <AlertCircle className='size-12 text-destructive' />
          <h3 className='text-lg font-semibold'>Invitation Error</h3>
          <p className='text-sm text-muted-foreground'>{error}</p>
          <Button variant='outline' onClick={() => router.push('/login')}>
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <Card>
        <CardContent className='flex flex-col items-center py-6xl gap-md text-center'>
          <CheckCircle2 className='size-12 text-success' />
          <h3 className='text-lg font-semibold'>Welcome aboard!</h3>
          <p className='text-sm text-muted-foreground'>
            Your account has been created. You can now log in to manage your location.
          </p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </CardContent>
      </Card>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className='text-center'>
        <div className='mx-auto mb-md size-12 rounded-full bg-primary/10 flex items-center justify-center'>
          <Building2 className='size-6 text-primary' />
        </div>
        <CardTitle className='text-xl'>Join {invitation?.organizationName}</CardTitle>
        <p className='text-sm text-muted-foreground mt-xs'>
          You have been invited to manage <strong>{invitation?.establishmentName}</strong>
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='space-y-lg'>
          <div className='grid grid-cols-2 gap-md'>
            <div className='space-y-xs'>
              <label htmlFor='firstName' className='text-sm font-medium'>
                First Name
              </label>
              <input
                id='firstName'
                type='text'
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className='w-full px-md py-sm border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30'
                required
                minLength={2}
                autoComplete='given-name'
              />
            </div>
            <div className='space-y-xs'>
              <label htmlFor='lastName' className='text-sm font-medium'>
                Last Name
              </label>
              <input
                id='lastName'
                type='text'
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className='w-full px-md py-sm border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30'
                required
                minLength={2}
                autoComplete='family-name'
              />
            </div>
          </div>

          <div className='space-y-xs'>
            <label htmlFor='password' className='text-sm font-medium'>
              Password
            </label>
            <input
              id='password'
              type='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              className='w-full px-md py-sm border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30'
              required
              minLength={8}
              placeholder='Min 8 chars, uppercase, lowercase, number, special'
              autoComplete='new-password'
            />
          </div>

          <div className='space-y-xs'>
            <label htmlFor='phoneNumber' className='text-sm font-medium'>
              Phone <span className='text-muted-foreground font-normal'>(optional)</span>
            </label>
            <input
              id='phoneNumber'
              type='tel'
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              className='w-full px-md py-sm border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30'
              placeholder='+216 XX XXX XXX'
              autoComplete='tel'
            />
          </div>

          <Button type='submit' className='w-full' disabled={submitting}>
            {submitting && <Loader2 className='size-4 me-sm animate-spin' />}
            Create Account &amp; Accept
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Fallback shown while useSearchParams resolves ─────────────────────────────
function AcceptInvitationFallback() {
  return (
    <div className='flex justify-center py-4xl'>
      <Loader2 className='size-8 animate-spin text-primary' />
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<AcceptInvitationFallback />}>
      <AcceptInvitationInner />
    </Suspense>
  );
}

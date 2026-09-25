/**
 * The reset-password form against the backend's error codes.
 *
 * Two things were wrong and nothing covered the form:
 * - it read `message.type === 'PASSWORD_REUSE_VIOLATION'`, a shape the backend
 *   never sent, so a reused password always got the generic error;
 * - it sent passwords the server's 12-character policy rejects.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { NextIntlClientProvider } from 'next-intl';

import en from '../../../messages/en.json';
import { ResetPasswordForm } from '../reset-password-form';

const mockResetPassword = jest.fn();
jest.mock('@/services/auth.service', () => ({
  authService: { resetPassword: (...args: unknown[]) => mockResetPassword(...args) },
}));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=abc'),
}));
jest.mock('@/i18n/routing', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

const STRONG = 'Correct@Horse9Battery';

const rejectWith = (status: number, data: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, null, {
    data,
    status,
    statusText: '',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  });

function submit(password: string) {
  render(
    <NextIntlClientProvider locale='en' messages={en}>
      <ResetPasswordForm />
    </NextIntlClientProvider>,
  );
  fireEvent.change(document.getElementById('password') as HTMLInputElement, {
    target: { value: password },
  });
  fireEvent.change(document.getElementById('confirmPassword') as HTMLInputElement, {
    target: { value: password },
  });
  fireEvent.submit(
    (document.getElementById('password') as HTMLInputElement).form as HTMLFormElement,
  );
}

beforeEach(() => mockResetPassword.mockReset());

describe('ResetPasswordForm', () => {
  it('does not send a password the policy rejects, and says what the rule is', async () => {
    submit('abcdefghijkl');

    expect(
      await screen.findByText(en.auth.passwordRequirements.replace('{min}', '12')),
    ).toBeTruthy();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('PASSWORD_REUSED -> the reuse message', async () => {
    mockResetPassword.mockRejectedValue(
      rejectWith(400, { code: 'PASSWORD_REUSED', message: 'x', details: { type: 'x' } }),
    );

    submit(STRONG);

    expect(await screen.findByText(en.auth.passwordReuseViolation)).toBeTruthy();
  });

  it("any other rejection -> the backend's own (translated) message", async () => {
    mockResetPassword.mockRejectedValue(
      rejectWith(400, { code: 'RESET_TOKEN_INVALID', message: 'Ce lien n’est plus valide.' }),
    );

    submit(STRONG);

    expect(await screen.findByText('Ce lien n’est plus valide.')).toBeTruthy();
  });

  it('no usable message (network failure, proxy page) -> the translated generic error', async () => {
    mockResetPassword.mockRejectedValue(rejectWith(502, '<html>Bad Gateway</html>'));

    submit(STRONG);

    await waitFor(() => expect(screen.getByText(en.auth.resetPasswordError)).toBeTruthy());
  });
});

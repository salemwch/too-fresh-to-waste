import { apiErrorCode, readApiError } from '../api-error';

describe('readApiError', () => {
  it('reads the code, the translated message, details and the support id', () => {
    const info = readApiError({
      status: 401,
      code: 'ACCOUNT_LOCKED',
      message: 'Trop de tentatives échouées.',
      details: { blockedUntil: '2026-09-25T12:00:00.000Z', type: 'ACCOUNT_LOCKED' },
      errorId: 'ERR-1',
    });

    expect(info).toEqual({
      code: 'ACCOUNT_LOCKED',
      message: 'Trop de tentatives échouées.',
      errorId: 'ERR-1',
      details: { blockedUntil: '2026-09-25T12:00:00.000Z', type: 'ACCOUNT_LOCKED' },
      fieldErrors: {},
    });
  });

  it('keeps the first message per field for inline form errors', () => {
    const info = readApiError({
      code: 'VALIDATION_FAILED',
      message: 'x',
      errors: [
        { field: 'email', code: 'VALIDATION_EMAIL', message: 'Adresse invalide' },
        { field: 'email', code: 'VALIDATION_REQUIRED', message: 'Obligatoire' },
        { field: 'password', code: 'VALIDATION_MIN_LENGTH', message: 'Au moins 12' },
        { field: '', code: 'X', message: 'dropped: no field' },
        'not an object',
      ],
    });

    expect(info.fieldErrors).toEqual({ email: 'Adresse invalide', password: 'Au moins 12' });
  });

  it.each([null, undefined, 42, [], ''])('yields an empty info for %j', body => {
    expect(readApiError(body)).toEqual({ details: {}, fieldErrors: {} });
  });

  // Not the API's own answer: a proxy's text must never reach a user, so the
  // caller falls back to its translated copy.
  it.each(['Bad Gateway', '<!DOCTYPE html><html><body>502 Bad Gateway</body></html>'])(
    'yields no message for a non-JSON body (%s)',
    body => {
      expect(readApiError(body)).toEqual({ details: {}, fieldErrors: {} });
    },
  );

  it('ignores a details value that is not an object', () => {
    expect(readApiError({ code: 'X', details: 'raw stack' }).details).toEqual({});
  });
});

describe('apiErrorCode', () => {
  it('reads an axios-style error', () => {
    expect(apiErrorCode({ response: { data: { code: 'EMAIL_NOT_VERIFIED' } } })).toBe(
      'EMAIL_NOT_VERIFIED',
    );
  });

  it('reads a code an app error already carries', () => {
    expect(apiErrorCode({ errorCode: 'PASSWORD_REUSED' })).toBe('PASSWORD_REUSED');
  });

  it.each([undefined, null, 'x', { response: { data: {} } }])('is undefined for %j', error => {
    expect(apiErrorCode(error)).toBeUndefined();
  });
});

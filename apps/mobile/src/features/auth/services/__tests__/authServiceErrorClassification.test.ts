import axios from 'axios';

import { ErrorType } from '@/utils/errorHandler';

import { authService } from '../authService';

/**
 * Covers the seam where an axios failure becomes an `AppError`.
 *
 * The bug this exists for: `handleRequestError` sent *every* axios error to
 * `handleHttpError`, which branches on `error.response.status`. A timeout has
 * no response, so no branch matched and it fell through to
 * `NETWORK / 'Network request failed'` - and the sign-in thunk, matching on the
 * word "network", told the user to check their internet while the server was
 * merely cold-starting (~54s against a 15s client timeout).
 *
 * Nothing failed when that was wrong, which is why these run: each case asserts
 * the `errorCode` the thunks actually branch on, not just that something threw.
 */

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

/** An axios rejection with no `response` - the shape a timeout really has. */
function axiosErrorWithoutResponse(code: string, message: string) {
  return Object.assign(new Error(message), { code, isAxiosError: true, response: undefined });
}

function axiosErrorWithResponse(status: number, data: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    code: 'ERR_BAD_REQUEST',
    isAxiosError: true,
    response: { status, data },
  });
}

async function loginAndCaptureError(): Promise<Record<string, unknown>> {
  try {
    await authService.login({ email: 'a@b.com', password: 'pw' });
  } catch (error) {
    return error as Record<string, unknown>;
  }
  throw new Error('login resolved, but the test needs it to reject');
}

beforeEach(() => {
  jest.clearAllMocks();
  // `isAxiosError` is a real function on the module; the automock stubs it, so
  // restore the behaviour every branch under test depends on.
  (mockedAxios.isAxiosError as unknown as jest.Mock).mockImplementation(
    (e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true,
  );
});

describe('errors with no HTTP response', () => {
  it('classifies an aborted request as TIMEOUT, not a connectivity failure', async () => {
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithoutResponse('ECONNABORTED', 'timeout of 15000ms exceeded'),
    );

    const error = await loginAndCaptureError();

    expect(error['type']).toBe(ErrorType.NETWORK);
    // The whole point. OFFLINE here is the regression.
    expect(error['errorCode']).toBe('TIMEOUT');
  });

  it('classifies ETIMEDOUT as TIMEOUT', async () => {
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithoutResponse('ETIMEDOUT', 'connect ETIMEDOUT'),
    );

    expect((await loginAndCaptureError())['errorCode']).toBe('TIMEOUT');
  });

  it('classifies a failed connection as OFFLINE', async () => {
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithoutResponse('ERR_NETWORK', 'Network Error'),
    );

    const error = await loginAndCaptureError();

    expect(error['type']).toBe(ErrorType.NETWORK);
    expect(error['errorCode']).toBe('OFFLINE');
  });

  it('keeps TIMEOUT and OFFLINE distinct', async () => {
    // Asserted as a pair because the failure mode is collapsing them, which a
    // pair of independent single-value assertions would not notice.
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithoutResponse('ECONNABORTED', 'timeout of 15000ms exceeded'),
    );
    const timedOut = await loginAndCaptureError();

    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithoutResponse('ERR_NETWORK', 'Network Error'),
    );
    const offline = await loginAndCaptureError();

    expect(timedOut['errorCode']).not.toBe(offline['errorCode']);
  });
});

describe('errors that do carry an HTTP response still reach the HTTP handler', () => {
  it('keeps the backend message on a 401', async () => {
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithResponse(401, { message: 'Invalid email or password' }),
    );

    const error = await loginAndCaptureError();

    // Proves the response-less short-circuit did not swallow real HTTP errors:
    // the backend's own wording survives, and it is not labelled NETWORK.
    expect(error['message']).toBe('Invalid email or password');
    expect(error['type']).not.toBe(ErrorType.NETWORK);
  });

  it('classifies a 500 as a server error, not a connectivity failure', async () => {
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithResponse(500, { message: 'Internal server error' }),
    );

    const error = await loginAndCaptureError();

    expect(error['type']).toBe(ErrorType.SERVER_ERROR);
  });

  it('preserves field-level validation errors on a 400', async () => {
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithResponse(400, {
        message: [{ property: 'email', constraints: { isEmail: 'email must be an email' } }],
      }),
    );

    const error = await loginAndCaptureError();

    // 400 is CLIENT_ERROR, not VALIDATION - that is reserved for 422 below.
    // What matters either way is that the per-field detail survives, because
    // LoginScreen reads it to mark the offending input rather than showing a
    // banner.
    expect(error['type']).toBe(ErrorType.CLIENT_ERROR);
    expect(error['validationErrors']).toEqual({ email: 'email must be an email' });
  });

  it('classifies a 422 as VALIDATION', async () => {
    (mockedAxios as unknown as jest.Mock).mockRejectedValueOnce(
      axiosErrorWithResponse(422, { message: 'Validation failed' }),
    );

    expect((await loginAndCaptureError())['type']).toBe(ErrorType.VALIDATION);
  });
});

// Tests for services/api timeout + error mapping.
//
// We mock global fetch + replace the i18n.t helper so error messages are
// predictable. We do NOT bring up a real server.

describe('apiService.request error handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('throws a localized timeout error when the request is aborted', async () => {
    jest.useFakeTimers();
    // Simulate a fetch that never resolves until aborted.
    global.fetch = jest.fn((_input, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          (err as Error & { name: string }).name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;

    const promise = apiService.getBills().catch((err: Error) => err);
    // Fast-forward 20s — past the 15s default DEFAULT_TIMEOUT_MS.
    jest.advanceTimersByTime(20_000);
    const err = await promise;
    expect(err).toBeInstanceOf(Error);
    // i18n key fallback returns the key if no translations are loaded; either way
    // we should not get the raw "aborted" message — it should be remapped.
    expect((err as Error).message).not.toBe('aborted');
    jest.useRealTimers();
  });

  it('throws a parse-failure error when the response is not JSON', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token');
        },
      }) as unknown as Response,
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await expect(apiService.getBills()).rejects.toThrow();
  });

  it('throws when the API envelope has success=false', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ success: false, error: 'errors.bill.not_found' }),
      }) as unknown as Response,
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await expect(apiService.getBill('id-1')).rejects.toThrow('errors.bill.not_found');
  });

  it('returns data on a successful envelope', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [{ id: 'b1' }] }),
      }) as unknown as Response,
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    const got = await apiService.getBills();
    expect(got).toEqual([{ id: 'b1' }]);
  });
});

// exchangeLine has bespoke envelope handling (must extract customToken)
// and is one of the few unauthenticated endpoints, so it gets its own block.
describe('apiService.exchangeLine', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns the customToken from a successful envelope', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { customToken: 'firebase-custom-token-xyz' },
          message: 'auth.line.signed_in',
        }),
      }) as unknown as Response,
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    const token = await apiService.exchangeLine('code-1', 'verifier-1', 'wattrent://redirect');
    expect(token).toBe('firebase-custom-token-xyz');
  });

  it('POSTs JSON {code, codeVerifier, redirectUri} to /auth/line/exchange', async () => {
    const fetchMock = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { customToken: 'tok' } }),
      }) as unknown as Response,
    ) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await apiService.exchangeLine('the-code', 'the-verifier', 'https://example.com/cb');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/line\/exchange$/);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      code: 'the-code',
      codeVerifier: 'the-verifier',
      redirectUri: 'https://example.com/cb',
    });
    // Unauthenticated endpoint: we should NOT have sent a Bearer header
    // when no auth token provider is configured.
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('throws auth.line.exchangeFailed when the envelope omits customToken', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      }) as unknown as Response,
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await expect(
      apiService.exchangeLine('code', 'verifier', 'https://example.com'),
    ).rejects.toThrow('auth.line.exchangeFailed');
  });

  it('propagates the backend i18n key when the envelope has success=false', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 400,
        json: async () => ({ success: false, error: 'errors.auth.line_invalid_code' }),
      }) as unknown as Response,
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await expect(
      apiService.exchangeLine('code', 'verifier', 'https://example.com'),
    ).rejects.toThrow('errors.auth.line_invalid_code');
  });
});

// Account deletion + data wipe both hit DELETE endpoints and just resolve on a
// success envelope. They are the destructive actions promised by the Play
// Store data-deletion page, so we pin the exact verb + path.
describe('apiService account deletion', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('deleteAccount sends DELETE /users/me', async () => {
    const fetchMock = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, message: 'users.account_deleted' }),
      }) as unknown as Response,
    ) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await expect(apiService.deleteAccount()).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/users\/me$/);
    expect(init.method).toBe('DELETE');
  });

  it('clearData sends DELETE /users/me/data', async () => {
    const fetchMock = jest.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, message: 'users.data_cleared' }),
      }) as unknown as Response,
    ) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await expect(apiService.clearData()).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/users\/me\/data$/);
    expect(init.method).toBe('DELETE');
  });

  it('deleteAccount propagates the backend i18n key on failure', async () => {
    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        status: 502,
        json: async () => ({ success: false, error: 'errors.account.delete_failed' }),
      }) as unknown as Response,
    ) as unknown as typeof fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const apiService = require('../api').default;
    await expect(apiService.deleteAccount()).rejects.toThrow('errors.account.delete_failed');
  });
});

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

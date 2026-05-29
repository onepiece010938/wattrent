// Tests for lib/apiUrl resolution priority.
//
// We re-require the module per test so cached state in devMode does not leak.

describe('resolveApiUrl', () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  afterAll(() => {
    if (ORIGINAL_ENV) process.env.EXPO_PUBLIC_API_URL = ORIGINAL_ENV;
  });

  it('returns the staging fallback when nothing is configured', () => {
    // expo-constants is mocked to return an empty extra object in jest.setup.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveApiUrl } = require('../apiUrl');
    expect(resolveApiUrl()).toBe('https://wattrent-api-6aiyzfe65q-de.a.run.app/api/v1');
  });

  it('prefers EXPO_PUBLIC_API_URL over the staging fallback', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveApiUrl } = require('../apiUrl');
    expect(resolveApiUrl()).toBe('https://api.example.com/api/v1');
  });

  it('strips trailing slashes from EXPO_PUBLIC_API_URL', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1/';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveApiUrl } = require('../apiUrl');
    expect(resolveApiUrl()).toBe('https://api.example.com/api/v1');
  });

  it('uses devMode.apiUrlOverride over every other source when set', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com/api/v1';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dev = require('../devMode');
    await dev.setDevMode({ apiUrlOverride: 'http://192.168.0.50:8080/api/v1' });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveApiUrl } = require('../apiUrl');
    expect(resolveApiUrl()).toBe('http://192.168.0.50:8080/api/v1');

    dev.__resetDevModeForTests();
  });
});

// Tests for the dev mode state singleton.
//
// We use jest.resetModules + require() per test so the module-level
// `cached` / `loaded` / `listeners` state cannot leak between cases. Jest's
// CommonJS runtime does not support top-level dynamic `import()` without the
// experimental-vm-modules flag, so we stick to require().

describe('devMode', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns DEFAULTS before loadDevMode is called', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../devMode');
    const state = mod.getDevMode();
    expect(state.skipOcr).toBe(false);
    expect(state.forceMockHistory).toBe(false);
    expect(state.apiUrlOverride).toBe('');
    expect(mod.isLoaded()).toBe(false);
    mod.__resetDevModeForTests();
  });

  it('setDevMode updates the cache and persists to AsyncStorage', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../devMode');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage');

    await mod.setDevMode({ skipOcr: true, apiUrlOverride: 'http://x' });

    const state = mod.getDevMode();
    expect(state.skipOcr).toBe(true);
    expect(state.apiUrlOverride).toBe('http://x');

    const raw = await AsyncStorage.getItem('@wattrent/devMode');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed.skipOcr).toBe(true);
    expect(parsed.apiUrlOverride).toBe('http://x');
    mod.__resetDevModeForTests();
  });

  it('loadDevMode reads persisted state back', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.clear();
    await AsyncStorage.setItem(
      '@wattrent/devMode',
      JSON.stringify({ skipOcr: true, forceMockHistory: true, apiUrlOverride: 'http://z' }),
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../devMode');
    const state = mod.getDevMode();
    expect(state.skipOcr).toBe(false); // not loaded yet
    await mod.loadDevMode();
    const loaded = mod.getDevMode();
    expect(loaded.skipOcr).toBe(true);
    expect(loaded.forceMockHistory).toBe(true);
    expect(loaded.apiUrlOverride).toBe('http://z');
    expect(mod.isLoaded()).toBe(true);
    mod.__resetDevModeForTests();
  });

  it('subscribeDevMode fires on every change and respects unsubscribe', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../devMode');
    const cb = jest.fn();
    const unsub = mod.subscribeDevMode(cb);

    await mod.setDevMode({ skipOcr: true });
    await mod.setDevMode({ forceMockHistory: true });
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
    await mod.setDevMode({ skipOcr: false });
    expect(cb).toHaveBeenCalledTimes(2);
    mod.__resetDevModeForTests();
  });

  it('isAnyDevToggleActive is true when at least one toggle is non-default', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../devMode');
    expect(
      mod.isAnyDevToggleActive({
        skipOcr: false,
        forceMockHistory: false,
        apiUrlOverride: '',
      }),
    ).toBe(false);
    expect(
      mod.isAnyDevToggleActive({
        skipOcr: true,
        forceMockHistory: false,
        apiUrlOverride: '',
      }),
    ).toBe(true);
    expect(
      mod.isAnyDevToggleActive({
        skipOcr: false,
        forceMockHistory: false,
        apiUrlOverride: 'http://x',
      }),
    ).toBe(true);
    mod.__resetDevModeForTests();
  });

  it('isDevModeAvailable is true in __DEV__ regardless of env flag', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../devMode');
    // jest.setup.js sets __DEV__ = true, so this should always be true here.
    expect(mod.isDevModeAvailable()).toBe(true);
    mod.__resetDevModeForTests();
  });
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __telemetryInternals } = require('../telemetry');

describe('ConsoleTelemetry', () => {
  it('captureException logs an error', () => {
    const t = new __telemetryInternals.ConsoleTelemetry();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    t.captureException(new Error('boom'), { scope: 'x' });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('captureMessage logs at info severity by default', () => {
    const t = new __telemetryInternals.ConsoleTelemetry();
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    t.captureMessage('hello');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('setUser does not throw', () => {
    const t = new __telemetryInternals.ConsoleTelemetry();
    expect(() => t.setUser('uid-1')).not.toThrow();
    expect(() => t.setUser(null)).not.toThrow();
  });

  it('init resolves without error', async () => {
    const t = new __telemetryInternals.ConsoleTelemetry();
    await expect(t.init()).resolves.toBeUndefined();
  });
});

describe('SentryTelemetry', () => {
  it('init forwards DSN + env to Sentry.init', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('@sentry/react-native');
    sentry.init.mockClear();

    const t = new __telemetryInternals.SentryTelemetry('https://x@sentry.io/1');
    await t.init();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    const [args] = sentry.init.mock.calls[0];
    expect(args.dsn).toBe('https://x@sentry.io/1');
    expect(typeof args.environment).toBe('string');
  });

  it('captureException delegates to Sentry.captureException', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('@sentry/react-native');
    sentry.captureException.mockClear();

    const t = new __telemetryInternals.SentryTelemetry('https://x@sentry.io/1');
    await t.init();
    t.captureException(new Error('oops'));
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('captureException with context wraps in withScope', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('@sentry/react-native');
    sentry.withScope.mockClear();
    sentry.captureException.mockClear();

    const t = new __telemetryInternals.SentryTelemetry('https://x@sentry.io/1');
    await t.init();
    t.captureException(new Error('oops'), { foo: 'bar' });

    expect(sentry.withScope).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('setUser passes the {id} object when uid is set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sentry = require('@sentry/react-native');
    sentry.setUser.mockClear();

    const t = new __telemetryInternals.SentryTelemetry('https://x@sentry.io/1');
    await t.init();
    t.setUser('uid-1');
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'uid-1' });

    t.setUser(null);
    expect(sentry.setUser).toHaveBeenCalledWith(null);
  });
});

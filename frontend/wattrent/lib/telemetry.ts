// Telemetry adapter — single place to capture exceptions / messages.
//
// Implementation today: structured console logging (so it shows up in
// Metro / device logs / Cloud Logging for the web build).
//
// To wire in Sentry later:
//   1. npm install @sentry/react-native (native rebuild required).
//   2. In _layout.tsx, call telemetry.init() once after dev-mode loads.
//   3. Replace the console implementations below with Sentry.captureException
//      / Sentry.captureMessage. Read DSN from EXPO_PUBLIC_SENTRY_DSN.
//   4. Wrap RootLayout with Sentry.wrap() so unhandled errors surface.
//
// Keeping the adapter ensures every screen already calls the right hook.

const PREFIX = '[telemetry]';

type Severity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

interface Context {
  [key: string]: unknown;
}

export interface TelemetryAdapter {
  init(): Promise<void>;
  captureException(err: unknown, ctx?: Context): void;
  captureMessage(message: string, severity?: Severity, ctx?: Context): void;
  setUser(uid: string | null): void;
}

class ConsoleTelemetry implements TelemetryAdapter {
  private uid: string | null = null;

  async init(): Promise<void> {
    // no-op; Sentry replacement would initialise here
  }

  captureException(err: unknown, ctx?: Context): void {
    const payload = {
      uid: this.uid,
      ctx,
      stack: err instanceof Error ? err.stack : undefined,
    };
    // eslint-disable-next-line no-console
    console.error(PREFIX, err instanceof Error ? err.message : err, payload);
  }

  captureMessage(message: string, severity: Severity = 'info', ctx?: Context): void {
    const payload = { uid: this.uid, ctx };
    // eslint-disable-next-line no-console
    console.log(PREFIX, `[${severity}]`, message, payload);
  }

  setUser(uid: string | null): void {
    this.uid = uid;
  }
}

const telemetry: TelemetryAdapter = new ConsoleTelemetry();
export default telemetry;

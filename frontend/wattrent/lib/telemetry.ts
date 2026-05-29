// Telemetry adapter — single place to capture exceptions / messages.
//
// At runtime we pick exactly one of two implementations:
//
//   SentryTelemetry  — used when EXPO_PUBLIC_SENTRY_DSN is set (or the DSN is
//                      injected via app.config.js -> extra.sentryDsn). Delegates
//                      to @sentry/react-native.
//   ConsoleTelemetry — fallback. Structured console.log so events still surface
//                      in Metro / Hermes / web devtools without a DSN configured.
//
// Both implement the same TelemetryAdapter interface so call sites don't change.
//
// Wiring:
//   1. Set EXPO_PUBLIC_SENTRY_DSN (Terraform's observability module provisions
//      the DSN in Secret Manager; expose it to the EAS build as a secret).
//   2. _layout.tsx already calls telemetry.init() during boot.
//   3. The Sentry config plugin is added in app.config.js -> plugins, so source
//      maps and native crash reporting work in EAS builds.

import Constants from 'expo-constants';

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

function resolveDsn(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as { sentryDsn?: unknown } | undefined)?.sentryDsn;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return null;
}

function resolveEnv(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ENV;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as { env?: unknown } | undefined)?.env;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return __DEV__ ? 'development' : 'production';
}

class ConsoleTelemetry implements TelemetryAdapter {
  private uid: string | null = null;

  async init(): Promise<void> {
    // no-op
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

class SentryTelemetry implements TelemetryAdapter {
  private dsn: string;
  // We keep a reference to the Sentry module after init() so subsequent calls
  // do not pay the dynamic import cost. Typed as `any` because the official
  // types are version-specific and we want this adapter to compile regardless
  // of which @sentry/react-native minor is installed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sentry: any = null;

  constructor(dsn: string) {
    this.dsn = dsn;
  }

  async init(): Promise<void> {
    try {
      // Static require so this works in both Hermes (RN) and Jest's CJS
      // runtime. Dynamic import() needs --experimental-vm-modules under Jest 29
      // and would require extra config to compile correctly. Since
      // @sentry/react-native is already in dependencies, the bundler will tree-
      // shake when DSN is empty (we never construct SentryTelemetry).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@sentry/react-native');
      this.sentry = mod;
      mod.init({
        dsn: this.dsn,
        environment: resolveEnv(),
        // Tracing disabled at first; enable when we add navigation
        // instrumentation. Sampling at 0 prevents transactions but still lets
        // breadcrumbs / exceptions flow.
        tracesSampleRate: 0,
        // Default PII off so we never leak user input via breadcrumbs.
        sendDefaultPii: false,
        enableAutoPerformanceTracing: false,
      });
    } catch (err) {
      // Fall back silently to console behavior; we still want the app to boot.
      // eslint-disable-next-line no-console
      console.warn(PREFIX, 'Sentry init failed; falling back to console', err);
      this.sentry = null;
    }
  }

  captureException(err: unknown, ctx?: Context): void {
    if (!this.sentry) {
      // eslint-disable-next-line no-console
      console.error(PREFIX, err instanceof Error ? err.message : err, { ctx });
      return;
    }
    if (ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.sentry.withScope((scope: any) => {
        scope.setContext('app', ctx);
        this.sentry.captureException(err);
      });
    } else {
      this.sentry.captureException(err);
    }
  }

  captureMessage(message: string, severity: Severity = 'info', ctx?: Context): void {
    if (!this.sentry) {
      // eslint-disable-next-line no-console
      console.log(PREFIX, `[${severity}]`, message, { ctx });
      return;
    }
    if (ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.sentry.withScope((scope: any) => {
        scope.setContext('app', ctx);
        this.sentry.captureMessage(message, severity);
      });
    } else {
      this.sentry.captureMessage(message, severity);
    }
  }

  setUser(uid: string | null): void {
    if (!this.sentry) return;
    this.sentry.setUser(uid ? { id: uid } : null);
  }
}

const dsn = resolveDsn();
const telemetry: TelemetryAdapter = dsn ? new SentryTelemetry(dsn) : new ConsoleTelemetry();
export default telemetry;

/** Exposed for tests. Do not call from app code. */
export const __telemetryInternals = {
  ConsoleTelemetry,
  SentryTelemetry,
  resolveDsn,
  resolveEnv,
};

# Maestro E2E flows for WattRent

[Maestro](https://maestro.mobile.dev/) is a YAML-based UI test runner that
works against installed iOS / Android builds without modifying native code,
so it fits the Expo managed workflow perfectly.

## Run locally

```bash
# 1. Install the CLI (macOS / Linux only — Windows users: run inside WSL).
curl -Ls "https://get.maestro.mobile.dev" | bash

# 2. Start an Expo dev build on a simulator or device.
#    (Expo Go works for most flows; for AdMob you need a dev build.)
cd ../..      # frontend/wattrent
npx expo run:ios     # or run:android

# 3. Run a single flow against the running app.
maestro test .maestro/sign-in.yaml

# 4. Or run the whole suite.
maestro test .maestro/
```

## What's covered

| File | Verifies |
| --- | --- |
| `sign-in.yaml` | Sign-in screen renders, accepts email + password, lands on Home tab |
| `sign-up.yaml` | Create-account screen renders, validates password length, requires confirmation |
| `bill-flow.yaml` | Home → Capture tab → enter meter reading → Save bill → see it on History |
| `settings-and-signout.yaml` | Settings tab → change electricity rate → sign out → back on auth screen |
| `bypass-mode-smoke.yaml` | When Firebase isn't configured, app lands directly on Home (AUTH_BYPASS dev path) |

## Conventions

- We target via `text:` where i18n-stable, falling back to `id:` for
  TextInputs that have `testID="..."` set on them.
- We do NOT depend on screenshot diffs — Maestro flows are written so they
  pass on both English and 繁體中文 locales by using `text:` snippets that
  appear in both (or by toggling locale via Settings before the assertion).
- **Run the suite before each EAS production build** — it's not blocking on
  every PR (would require Maestro Cloud) but a local sweep before submission
  catches regressions in the auth chain that unit tests can miss.

## Future: Maestro Cloud + CI

Maestro Cloud (paid) integrates with GitHub Actions:

```yaml
# .github/workflows/e2e.yml (opt-in, workflow_dispatch only)
- uses: mobile-dev-inc/action-maestro-cloud@v1
  with:
    api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
    app-file: ./build/wattrent.app
```

See [手動任務追蹤](../../../docs/手動任務追蹤.md) §B.4 — flagged as optional.

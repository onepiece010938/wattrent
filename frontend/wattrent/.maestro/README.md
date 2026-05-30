# Maestro E2E flows for WattRent

[Maestro](https://maestro.mobile.dev/) is a YAML-based UI test runner that
works against installed iOS / Android builds without modifying native code,
so it fits the Expo managed workflow perfectly.

> **TL;DR**:
> ```powershell
> just e2e-install        # one-time: install Maestro CLI
> just e2e-smoke          # quick smoke check against any running emulator
> just e2e                # full suite
> ```

---

## How E2E fits the test pyramid

```
┌─────────────────────────────────────┐
│ Maestro (.maestro/*.yaml) ← few     │  whole-app on a real emulator
├─────────────────────────────────────┤
│ Jest unit + component                │  fast; runs on every commit
├─────────────────────────────────────┤
│ go test (handlers + services)        │  fast; runs on every commit
└─────────────────────────────────────┘
```

Run Jest + `go test` on every save (cheap). Run Maestro **before pushing**
when you've touched auth / capture / settings flows, and let CI re-run it
nightly so regressions get caught even if you forget.

---

## Local quick start

### 0. Get a target device

Maestro needs a running iOS simulator or Android emulator with the
WattRent app installed.

- **Easiest**: `cd frontend/wattrent ; npx expo run:android` (or `run:ios`
  on macOS) — this builds a dev client, boots the emulator/simulator,
  installs the app, and starts Metro all in one go. Leave that terminal
  open while you run Maestro.
- **If you only have Expo Go**: that works for any flow that doesn't need
  AdMob (flows starting with `bypass-mode-smoke`, `sign-in`, `sign-up`).
  AdMob + capture flows need a dev build because the native module is not
  in Expo Go.

### 1. Install the Maestro CLI

| Platform | Install |
| --- | --- |
| **Windows** (you) | `just e2e-install` (installs into WSL Ubuntu) |
| macOS / Linux | `just e2e-install` (installs natively) |

Manual fallback: `curl -Ls https://get.maestro.mobile.dev | bash`.

After install, sanity-check with `just e2e-doctor` — it prints the Maestro
version and the list of devices Maestro can see via `adb`.

### 2. Run a single flow

```powershell
just e2e-one .maestro/sign-in.yaml
# or, from inside frontend/wattrent:
npm run e2e:one .maestro/sign-in.yaml
```

### 3. Run the whole suite

```powershell
just e2e
# or:
cd frontend\wattrent ; npm run e2e
```

### 4. Record a new flow interactively

```powershell
just e2e-studio
```

Studio opens a browser UI mirroring the emulator. Every tap you make is
appended to a YAML draft you can save into `.maestro/`.

---

## Windows specifics (you are here)

Maestro CLI is bash-first; it doesn't ship a Windows binary. We use WSL2
for the CLI and a Windows-side Android emulator. ADB bridges them.

### One-time setup

1. **Enable WSL2 + install Ubuntu** (skip if you already have it):
   ```powershell
   wsl --install -d Ubuntu
   ```
   Reboot when prompted, finish the Ubuntu first-launch user setup.

2. **Install Maestro inside WSL**: `just e2e-install` (uses `wsl bash -c`
   automatically when run from Windows PowerShell).

3. **Install Android Studio on Windows** + create an AVD (Android Virtual
   Device) via Tools → Device Manager. Pixel 7 / API 34 is a sensible
   default.

4. **Make sure ADB is on PATH on the Windows side** — Android Studio puts
   it at `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`. Add that
   folder to the User PATH. Verify with `adb devices`.

5. **Make ADB available inside WSL too** so Maestro can reach the emulator:
   ```bash
   # Inside WSL:
   sudo apt update && sudo apt install -y android-tools-adb
   # Point WSL at the Windows-side adb server (started when the emulator boots).
   # Find your host IP:
   ip route show | grep -i default | awk '{ print $3}'
   # Then in ~/.bashrc add (replace 172.x with what you got above, or use the
   # automatic helper):
   echo 'export ADB_SERVER_SOCKET=tcp:$(ip route show | grep -i default | awk "{ print \$3 }"):5037' >> ~/.bashrc
   ```

### Daily run

```powershell
# Terminal 1: boot emulator + install app
cd frontend\wattrent
npx expo run:android          # leaves Metro running

# Terminal 2: run the E2E suite
just e2e-smoke                # ~30s, no Firebase needed
just e2e                      # full suite, ~3 min
```

---

## What's covered

| File | Verifies | Needs real Firebase user? |
| --- | --- | --- |
| `bypass-mode-smoke.yaml` | App lands on Home in dev / bypass mode | No |
| `sign-in.yaml` | Sign-in screen + valid credentials → Home | Yes (or bypass) |
| `sign-up.yaml` | Create-account flow end-to-end | Creates a real user |
| `bill-flow.yaml` | Capture → save → see-it-on-history | Needs dev build (camera mock) |
| `settings-and-signout.yaml` | Settings → sign out → back at auth screen | Yes |

### About the flows that need credentials

The sign-in / sign-out / sign-up flows expect Firebase Auth env vars in
the build. For local runs against a build with `EXPO_PUBLIC_FIREBASE_*`
unset, only `bypass-mode-smoke.yaml` works — that's exactly what
`just e2e-smoke` runs.

Override credentials per-run:

```bash
maestro test .maestro/sign-in.yaml -e E2E_EMAIL=me@example.com -e E2E_PASSWORD='hunter2'
```

---

## CI

Two workflows ship in `.github/workflows/`:

| Workflow | Trigger | Cost | When to use |
| --- | --- | --- | --- |
| [`e2e-android-ci.yml`](../../../.github/workflows/e2e-android-ci.yml) | nightly cron + `workflow_dispatch` + PR label `run-e2e` | free (uses GH-hosted Android emulator) | Default regression catch-net |
| [`e2e-maestro.yml`](../../../.github/workflows/e2e-maestro.yml) | `workflow_dispatch` only | paid (Maestro Cloud) | One-off cross-device matrix runs |

The free workflow uses [`reactivecircus/android-emulator-runner`](https://github.com/ReactiveCircus/android-emulator-runner)
so it boots an Android emulator on a Linux runner, installs an APK that
EAS built for you (or that the workflow builds via `eas build --local`),
then runs Maestro the exact same way you do locally.

---

## Conventions for writing flows

- Target via `text:` where i18n-stable, falling back to `id:` for
  TextInputs that have `testID="..."` set on them.
- We do NOT depend on screenshot diffs — flows pass on both English and
  繁體中文 locales by using `text:` snippets that appear in both, or by
  toggling locale via Settings before the assertion.
- One assertion per `assertVisible`; chain `tapOn`s aggressively rather
  than over-using `runFlow`.
- **Run the suite before each EAS production build** — see
  [docs/release-checklist.md](../../../docs/release-checklist.md).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `maestro: command not found` in PowerShell | Tried to call CLI directly from Windows | Use `just e2e` recipes (they go through WSL), or call `wsl maestro ...` manually |
| `No devices/emulators connected` | Maestro can't reach `adb` | On Windows/WSL: make sure emulator is running and `adb devices` lists it from inside WSL too |
| Flow times out at `assertVisible: "WattRent"` | App isn't installed, or you're on a wrong build | Re-run `npx expo run:android` (or `run:ios`) and wait for Metro to bundle |
| "Element not found" right after `inputText:` | Keyboard is covering the next field | Add `- hideKeyboard` between inputs |
| Flow passes locally but fails in CI | Locale mismatch (zh-TW vs en) | Pin the locale in the flow with `- launchApp:` `arguments: ["-AppleLanguages", "(en)"]` |

---

## See also

- [Maestro docs](https://maestro.mobile.dev/)
- [docs/手動任務追蹤.md](../../../docs/手動任務追蹤.md) §B.4 — optional follow-ups

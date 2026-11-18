# Development (Windows-first)

The mobile app lives in [`apps/mobile`](../apps/mobile) — Expo SDK 58, React Native 0.88, React 19.3,
TypeScript 6, Expo Router. All activity data is simulated; no health permissions are requested.

## Windows 11 setup

### 1. Install the tools (one time)

Open **PowerShell** and run each line (accept the prompts):

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Microsoft.VisualStudioCode -e
```

Close and reopen PowerShell, then confirm:

```powershell
node --version   # must be v22.13+ , v24.3+ or v26.x
npm --version
git --version
```

If PowerShell says _"running scripts is disabled on this system"_ when you run `npm` or `npx`, run
this once and reopen PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Recommended Git settings for this repo on Windows (long `node_modules` paths, LF line endings):

```powershell
git config --global core.longpaths true
git config --global core.autocrlf false
```

### 2. Get the code and install dependencies

```powershell
git clone https://github.com/levitatedd/thoenefit-rivals.git
cd thoenefit-rivals
git checkout staging
cd apps\mobile
npm ci
```

### 3. Run the app on your phone (no Android Studio needed)

1. Install **Expo Go** on the phone:
   - Android: Google Play → "Expo Go".
   - iPhone: App Store → "Expo Go". The project targets SDK 58; if Expo Go says the project is
     incompatible, the store build has not caught up yet — see [iPhone notes](#iphone-notes).
2. Connect the phone and the PC to the **same Wi-Fi network**.
3. In `apps\mobile`, run:

   ```powershell
   npm start
   ```

4. If Windows Defender Firewall asks about **Node.js**, allow it on **Private networks**.
5. Scan the QR code in the terminal — Android: from inside Expo Go; iPhone: with the Camera app.

If the phone can't connect (guest/office Wi-Fi, VPN), use a tunnel instead: `npm start -- --tunnel`
(Expo may offer to install `@expo/ngrok` the first time; answer yes).

Edits to files under `src/` reload on the phone automatically. Press `r` in the terminal to reload,
`Ctrl+C` to stop.

### 4. Optional: Android emulator

Only needed if you want to test without a phone.

1. Install [Android Studio](https://developer.android.com/studio) → **More Actions → Virtual Device
   Manager** → create a recent Pixel device and start it.
2. Set `ANDROID_HOME` (usually `%LOCALAPPDATA%\Android\Sdk`) and add
   `%LOCALAPPDATA%\Android\Sdk\platform-tools` to `Path`, then reopen PowerShell.
3. In `apps\mobile`, run `npm run android`.

### iPhone notes

Windows cannot run Xcode or the iOS Simulator. On Windows, iOS options are:

- **Expo Go** on a real iPhone (above) — enough for the current simulated-data app.
- **Cloud builds with EAS** — required later for HealthKit (#4), because native health modules do not
  run in Expo Go. This needs a free Expo account and an Apple Developer Program membership
  (paid; not set up — requires owner approval).

## Automated checks

From `apps\mobile`:

```powershell
npm run check
```

This runs, in order: `tsc --noEmit`, `expo lint` (ESLint 9 + `eslint-config-expo` + Prettier
compatibility), `prettier --check`, and Jest (`jest-expo` preset + React Native Testing Library).
All must pass before opening a PR.

Individual commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run format`
(auto-fix formatting), `npm run doctor` (Expo's project health check; needs internet).

## Dependency policy

- Versions in `apps/mobile/package.json` are pinned exactly (`.npmrc` sets `save-exact`) and
  `package-lock.json` is committed. Use `npm ci` for installs.
- Add packages with `npx expo install <package>` so native modules match SDK 58.
- `react-dom` is pinned to the same version as `react` even though the app is native-only:
  `expo-router` depends on packages that peer-depend on it, and without the pin `npm ci` fails with a
  peer-dependency conflict.
- `npm audit` reports advisories in build-time tooling only (Metro, Expo CLI, Jest, ESLint), not in the
  shipped app. Do not run `npm audit fix --force`: it downgrades Expo and React Native. See
  [DEPENDENCY-AUDIT.md](DEPENDENCY-AUDIT.md) for the full analysis and follow-up policy.

## Simulated data

`SimulatedActivitySource` (`src/features/activity/simulated-source.ts`) generates deterministic
daily steps and active energy (same seed + date → same numbers); today's totals grow with the time
of day. The UI always shows a "Simulated data" notice. Real adapters (HealthKit, Health Connect)
will implement the same `ActivityDataSource` interface.

## iOS limitations

Windows can edit shared React Native code and use cloud iOS builds, but Xcode and local iOS
simulators require macOS. Native health bridges require development builds, not Expo Go. iOS device
signing and external beta distribution may require Apple Developer Program enrollment.

## Branches

Create feature branches from `staging` (`feature/<issue>-short-name`), open PRs back into `staging`,
run tests, and promote tested work to `main` through a separate PR.

## Release gates

No production health data or public distribution until permissions, privacy policy, security, data
deletion, and real-device sync are validated.

Never commit credentials, signing certificates, health data, or API secrets.

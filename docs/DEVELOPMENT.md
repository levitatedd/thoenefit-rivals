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

Individual commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run format`, `npm run simulate:report`
(regenerates [SCORING-VALIDATION.md](SCORING-VALIDATION.md) from the seeded scoring simulations; takes a few minutes),
(auto-fix formatting), `npm run doctor` (Expo's project health check; needs internet).

## Continuous integration (GitHub Actions)

Workflows live in `.github/workflows/`. Third-party actions are pinned to exact commit SHAs.

| Workflow | Runs on | What it does |
| --- | --- | --- |
| **CI** (`ci.yml`) | PRs into `staging`/`main`; pushes to `staging`/`main` | **Mobile checks (Linux)**: `npm ci`, typecheck, lint, format check, Jest, Android + iOS bundle build, automation-script tests. **Mobile checks (Windows)** (PRs only): `npm ci` + `npm run check` on Windows. **Dependency audit**: posts all `npm audit` advisories to the run summary and fails only on **critical**. **Project board (In Review)**: see below. |
| **Project board status** (`project-status.yml`) | Issue label/reopen/close; PR closed or converted to draft | Board transitions and closing issues when a PR merges into `staging`. |
| **Android emulator smoke test** (`android-smoke.yml`) | Opt-in: add the `android-smoke` label to a PR | Builds a standalone Android APK, launches it on an emulator (API 35), checks the simulated dashboard with steps and active energy appears, uploads a screenshot + logs as the `android-smoke-results` artifact. Unrelated emulator system dialogs (e.g. "Pixel Launcher isn't responding") are dismissed; a dialog about this app fails the test. Timing: see below. |

**Android smoke test caching (#19).** The build and the emulator run in separate jobs. The APK is
cached by a hash of the app's sources (re-running with no app changes skips the build), Gradle state
uses the open-source `basic` GitHub Actions cache provider, and the emulator image plus a booted
snapshot are cached. GitHub caches are scoped per branch, so the **first** run on a PR is cold
(measured 28.6 min) and later runs on the same PR are warm: **3.4 min** when the app is
unchanged (build skipped, emulator warm-boots), and **11.4 min** when app code changed
(Gradle cache restored, emulator warm-boots). To force a fresh emulator
cache, bump `AVD_CACHE_VERSION` in the workflow.

**Actions minutes:** this repository is private, so runs use the account's monthly free minutes
(Windows minutes count double). With GitHub's default $0 spending limit, running out pauses
workflows rather than charging. The Windows job and the Android smoke test are limited to PRs /
opt-in for this reason.

**Recommended (owner, one time):** protect `staging` and `main` so merges require the
**Mobile checks (Linux)**, **Mobile checks (Windows)** and **Dependency audit** checks:
_Settings → Rules → Rulesets → New branch ruleset_ → target `staging` and `main` → enable
**Require status checks to pass** and add those three checks → **Require a pull request before
merging**.

## Project board automation

Board: [ThoeneFit: Rivals (Project #4)](https://github.com/users/levitatedd/projects/4/views/1).
Statuses: **Todo → In Progress → In Review → Done**.

### How each transition happens

| Transition | Trigger | Implemented by |
| --- | --- | --- |
| → **Todo** | New issue/PR opened | Project built-in workflows: *Auto-add to project* + *Item added to project* |
| → **In Progress** | `status: in progress` label added to an open issue (the explicit "work started" signal; a branch alone is not) | `project-status.yml` |
| → **In Review** | Non-draft PR into `staging` links the issue (`Closes #N` / `Refs #N`) **and** CI passes | `ci.yml` → *Project board (In Review)* |
| In Review → **In Progress** | CI fails on that PR, the PR is converted to draft, or it is closed without merging | `ci.yml` / `project-status.yml` |
| → **Done** | PR with `Closes #N` merges into `staging` (the workflow also closes the issue), or the issue is closed | `project-status.yml` (+ built-in *Item closed*) |
| Done → **Todo** | Issue reopened (→ **In Progress** if it still has the label) | `project-status.yml` (+ built-in *Item reopened*) |

The custom workflow and the built-in workflows set the same statuses, so keeping both enabled is
safe; the custom one is idempotent and never moves a card backwards except for the cases above.
Every run writes a **Project board status** table to its job summary showing each issue's
before/after status, and an update is only reported as successful after reading it back from the
board.

### Why a token is needed

- The default `GITHUB_TOKEN` is scoped to the repository and **cannot** edit a Project owned by a
  personal account. GitHub's guidance for automating user-owned Projects from Actions is a personal
  access token stored as a repository secret.
- Claude Code cannot move cards directly in this environment: the GitHub tools available to it have
  no Projects API access, and `gh project item-edit` is not available to it. It drives the board
  through the label above and the workflows.
- Without the secret, the workflows still run, **do not** change the board, and say so with a
  warning (`PROJECT_TOKEN secret … is not configured, so the Project board was NOT updated`).

### One-time owner setup

1. **Check the Project's built-in workflows** — open the board → **⋯** (top right) → **Workflows**.
   Make sure these are **On**:
   - *Auto-add to project* — repository `thoenefit-rivals`, filter `is:issue,pr is:open`
   - *Item added to project* → Status **Todo**
   - *Item closed* → Status **Done**
   - *Pull request merged* → Status **Done**
   - *Item reopened* → Status **Todo** (if listed)
2. **Create a token** — GitHub → profile picture → **Settings → Developer settings → Personal access
   tokens → Tokens (classic) → Generate new token (classic)**:
   - Note: `thoenefit-rivals project automation`
   - Expiration: 90 days (set a reminder to rotate it)
   - Scopes: **`project`** and **`repo`** (repo is needed to read issues in this private repository)
   - Generate, then copy the token (it is shown once).

   A fine-grained token may also work if its settings page offers **Projects: Read and write** for
   your account plus **Issues: Read** on this repository; this could not be verified from Claude's
   environment, so the classic token is the documented path.
3. **Store it as a secret** — repository → **Settings → Secrets and variables → Actions → New
   repository secret** → Name `PROJECT_TOKEN`, paste the token. Never paste it into an issue, PR,
   chat, or file.
4. Optional: if the board number ever changes, add a repository **variable** `PROJECT_NUMBER`
   (same page, *Variables* tab). Default: `4`.

### Limitations

- **Issue-triggered transitions** (label → In Progress, reopened, closed) run only after
  `project-status.yml` is on `main`, because GitHub runs `issues` workflows from the default branch
  only. PR-triggered transitions (In Review, back to In Progress, Done on merge) work from `staging`.
- Linked issues are read from the PR **title and description** at the time of the CI run or
  close event. Editing the description later does not re-run CI; push a commit (or close/reopen
  the PR) to re-evaluate.
- GitHub only auto-closes issues for PRs merged into the default branch; the workflow closes
  `Closes #N` issues itself when a PR merges into `staging`.
- PRs from forks are ignored (they cannot access secrets).
- [Master backlog #1](https://github.com/levitatedd/thoenefit-rivals/issues/1) is **not** updated
  by automation; Claude Code keeps it in sync manually.
- If the token expires or loses access, runs report `Cannot access the project board` and fail
  the board step (it never blocks merging).

### Verification checklist (after adding `PROJECT_TOKEN`)

1. Open a test issue → it appears in **Todo** (built-in).
2. Add the `status: in progress` label → **In Progress** _(requires the workflow on `main`)_.
3. Open a **draft** PR into `staging` with `Closes #<test issue>` → stays **In Progress**.
4. Mark it ready for review → after CI passes, **In Review**.
5. Convert it back to draft → **In Progress**; mark ready again → **In Review**.
6. Close the PR without merging → **In Progress**, issue stays open.
7. Reopen and merge it → issue is closed and **Done**.
8. Reopen the issue → **Todo**.

Each step's result appears in the run's job summary under **Project board status**.

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

Permanent: `main` (stable releases) and `staging` (integration). All work happens on a short-lived
branch created from `staging`, merged back by PR into `staging`. The prefix is the release-notes
category:

| Prefix      | Category in release notes | Use for                                         |
| ----------- | ------------------------- | ----------------------------------------------- |
| `feature/`  | **New**                   | New user-facing capability                      |
| `improve/`  | **Improved**              | Polish or enhancement of existing functionality |
| `fix/`      | **Fixed**                 | Bug fixes                                       |
| `chore/`    | _omitted_                 | Tests, docs, CI, tooling, maintenance           |

Name branches `<prefix>/<issue>-short-description`, e.g. `feature/2-scoring-engine`. A single
`category: new|improved|fixed|chore` label on the PR overrides the prefix. Write PR titles as the
plain-language line a user would read in What's New. Details: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Versioning

**One source of truth:** `apps/mobile/package.json` → `"version"` (SemVer `MAJOR.MINOR.PATCH`,
currently pre-1.0, started at `0.1.0`). `apps/mobile/app.config.js` passes it to Expo; `app.json`
has no version. Never edit the version by hand in several places — use the release tooling below.

| Value | Where it comes from | Notes |
| --- | --- | --- |
| App version (`expo.version`, iOS `CFBundleShortVersionString`, Android `versionName`) | `package.json` | Numbers only (`0.2.0`); iOS rejects `-beta` style suffixes. |
| Build number (iOS `buildNumber`, Android `versionCode`) | `APP_BUILD_NUMBER` env var, default `1` | Must only ever increase per store upload. Not committed. CI passes its run number; when store builds start, EAS remote versioning (`autoIncrement`) will own it. |
| Variant | `APP_VARIANT` = `development` (default) / `staging` / `production` | Shown on the About screen with version and build. Never changes the version. |

**How the version changes (pre-1.0):**

| Changes in the release | Bump | Example |
| --- | --- | --- |
| At least one **New** | minor | 0.1.0 → 0.2.0 |
| Only **Improved** / **Fixed** | patch | 0.2.0 → 0.2.1 |
| Only chores | none | stays 0.2.1 |
| 1.0.0 or a breaking change | major | owner decision only, never automatic |

The version changes **only when preparing a promotion to `main`**, never in feature PRs. A
`staging` build therefore carries the version of the *next* release only after release
preparation; before that it reports the last released version, and is told apart by its build
number and `staging` variant. Logic and tests: `apps/mobile/config/version.js`.

## Releases

Release notes are generated from merged PR metadata (branch category or label, PR title, linked
issues) by `.github/scripts/release/cli.js`:

- **What's in a release:** every PR merged into `staging` whose merge commit is on `staging` but
  not yet on `main` (`git rev-list origin/main..origin/staging`). Unmerged and future work is never
  included, and PRs already shipped are excluded.
- **No double counting:** each PR appears once; `CHANGELOG.md` records every released PR number
  (chores included) in a hidden `<!-- released-prs: … -->` marker, used as a second guard.
- **Merge strategy:** PRs into `staging` may use any merge method. **Promotions into `main` must use
  "Create a merge commit"** — squashing a promotion would make the next release re-list old PRs
  (the marker guard catches this and warns).

Commands (run by Claude Code; the owner never needs to):

```bash
node .github/scripts/release/cli.js notes --base origin/main --head origin/staging
node .github/scripts/release/cli.js prepare --base origin/main --head origin/staging
node .github/scripts/release/cli.js check --base origin/main --head HEAD
```

- `notes` prints the categorised preview and the suggested bump.
- `prepare` bumps `apps/mobile/package.json` (and lockfile) once via `npm version` and prepends the
  entry to `CHANGELOG.md`; done on a `chore/release-x.y.z` branch merged into `staging` right
  before the promotion PR.
- `check` fails if the release needs a bump that wasn't made, or `CHANGELOG.md` lacks the entry.

CI (`release-notes.yml`) posts the preview on every PR into `staging`, and runs `check` as a
**blocking** step on promotion PRs into `main`. Promotion still needs explicit owner approval and
the release summary in [RELEASING.md](RELEASING.md).

## Release gates

No production health data or public distribution until permissions, privacy policy, security, data
deletion, and real-device sync are validated.

Never commit credentials, signing certificates, health data, or API secrets.

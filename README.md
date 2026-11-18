<p align="center">
  <img src="https://raw.githubusercontent.com/levitatedd/thoenefit/main/web/icons/logo-wide.png" width="80%" alt="ThoeneFit logo">
  <br>
  <img src="docs/branding/rivals-wordmark.svg" width="52%" alt="Rivals">
</p>

**Challenge your friends, whatever watch they wear.**

ThoeneFit Rivals is an early-stage cross-platform fitness competition app for iPhone and Android. Challenge friends using personal activity goals, with Step Battle and Calorie Clash scoring. The app is currently a simulated prototype, not a connected fitness tracker.

**Explore** · [Screenshots and demo](#screenshots-and-demo) · [Features](#features) · [Getting started](#getting-started)

**Build and maintain** · [Documentation](#documentation) · [Development](#development) · [Privacy and licensing](#privacy-and-licensing)

<a name="screenshots-and-demo"></a>

## Screenshots and demo

> **Pre-alpha:** An Expo / React Native app shell with simulated activity data is available in [`apps/mobile`](apps/mobile). Screenshots will be added when the competition dashboard and leaderboard are ready (#3). No native health integrations or watch apps are implemented yet.

<a name="features"></a>

## Features

<details>
<summary><strong>Competition scoring — implemented engine, simulated data</strong></summary>

- **Step Battle** scores eligible steps; **Calorie Clash** scores eligible active calories. The two metrics are never mixed.
- **Personal daily goals** are locked at competition start; points reflect each player's progress toward their own goal.
- **Daily scoring:** `min(200, 100 × eligible activity ÷ locked daily goal)`; daily capped points are summed over the competition.
- **Fairness guidance** privately warns about goals that may be unusually easy; it never penalizes or changes scores.
- **Exact ties**, time-zone-aware competition days, provisional scoring and a 24-hour synchronization grace period.
- **Conservative source eligibility:** manual entries and confirmed duplicates are excluded; uncertain overlaps and midnight-spanning records are held pending better data.
- [Full scoring rules](docs/SCORING.md)

</details>

<details>
<summary><strong>Competition experience — planned</strong></summary>

- Simulated competition dashboard and leaderboard (#3).
- Private friend challenges, competition history and achievements as roadmap features.
- Automated synthetic scoring simulations (#14) before real-world playtesting.

</details>

<details>
<summary><strong>Health integrations — planned</strong></summary>

- iOS Apple Health / HealthKit (#4) and Android Health Connect (#5).
- Import eligible automatically tracked activity from supported connected providers **when the platform actually supplies the data and provenance**.
- Phone-only steps can work without a smartwatch; available metrics depend on device, permissions and providers.
- Activity ingestion and synchronization (#6), with day-bounded samples and duplicate detection.

</details>

<a name="getting-started"></a>

## Getting started

On Windows 11, install Git and Node.js LTS, then:

```powershell
cd apps\mobile
npm ci
npm start
```

Scan the QR code using Expo Go. Full instructions: [Windows development](docs/DEVELOPMENT.md).

<a name="documentation"></a>

## Documentation

| Guide | Purpose |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | App design and integrations |
| [Scoring rules](docs/SCORING.md) | Competition math, eligibility, fairness and timing |
| [Roadmap](docs/ROADMAP.md) | Planned milestones |
| [Development](docs/DEVELOPMENT.md) | Local setup and testing |
| [Contributing](CONTRIBUTING.md) | Issues, branches and PR workflow |
| [Releasing](docs/RELEASING.md) | `staging` → `main` checklist |
| [Changelog](CHANGELOG.md) | Versioned user-facing release notes |
| [Dependency audit](docs/DEPENDENCY-AUDIT.md) | Dependency review |

[Master backlog #1](https://github.com/levitatedd/thoenefit-rivals/issues/1) · [Project board](https://github.com/users/levitatedd/projects/4/views/1) · [Issues](../../issues)

<a name="development"></a>

## Development

<details>
<summary><strong>Branches, CI and releases</strong></summary>

- `main` holds stable reviewed releases; `staging` is for integration and testing.
- Short-lived branches from `staging`: `feature/` (New), `improve/` (Improved), `fix/` (Fixed), `chore/` (internal maintenance).
- Pull requests target `staging`; CI checks typecheck, lint, formatting, tests, bundling and dependencies.
- Releases require an owner-approved promotion PR to `main`, with a version bump and generated release notes.
- Track future fixes and resolved issues in the GitHub backlog. See [Contributing](CONTRIBUTING.md).

</details>

<a name="privacy-and-licensing"></a>

## Privacy and licensing

Health data is sensitive. Explicit permissions, data minimization, access controls, deletion and privacy documentation are prerequisites for beta. Never commit real health records or secrets.

License undecided. This repository is private and does not currently grant an open-source license.

# ThoeneFit Rivals

**Challenge your friends, whatever watch they wear.**

A planned cross-platform fitness competition app for iPhone and Android. Compete with friends across supported wearables using customizable challenges and personalized activity goals.

> **Status:** Pre-alpha. An Expo / React Native app shell with **simulated** activity data lives in [`apps/mobile`](apps/mobile). No native health integrations or watch apps are implemented yet.

## Vision

- Cross-platform competitions across Apple Watch, Pixel Watch, Galaxy Watch, and eventually other supported devices.
- Start with active calories and steps; keep scoring configurable.
- Support goal percentages, weighted metrics, and competition-specific rules.
- Private challenges, leaderboards, trophies, and bragging rights.

## Quick start (Windows 11)

Install Git and Node.js LTS, then:

```powershell
cd apps\mobile
npm ci
npm start
```

Scan the QR code with Expo Go on your phone. Full steps: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Scoring rules](docs/SCORING.md)
- [Scoring validation (simulations)](docs/SCORING-VALIDATION.md)
- [Windows development](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Dependency audit](docs/DEPENDENCY-AUDIT.md)
- [Contributing](CONTRIBUTING.md) — issues, branches, PRs, board statuses
- [Releasing](docs/RELEASING.md) — `staging` → `main` checklist
- [Changelog](CHANGELOG.md) — user-facing changes per version
- [Master backlog — Issue #1](https://github.com/levitatedd/thoenefit-rivals/issues/1)
- [GitHub Projects board](https://github.com/users/levitatedd/projects/4/views/1)
- [GitHub Issues](../../issues)

## Development workflow

- `main`: stable reviewed releases.
- `staging`: integration and testing.
- `feature/`, `improve/`, `fix/`, `chore/` + `<issue>-short-name`: short-lived branches from `staging`, PRs into `staging`; the prefix sets the release-notes category.
- Every PR runs CI (typecheck, lint, format, tests, bundle build, dependency audit) on Linux and Windows.
- Promote tested work from `staging` to `main` via pull request ([checklist](docs/RELEASING.md)).
- Track future fixes and resolved work in GitHub Issues. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy and licensing

Health data is sensitive. Explicit permissions, data minimization, access controls, deletion, and privacy documentation are prerequisites for beta. Never commit real health records or secrets.

License undecided. This repository is private and does not currently grant an open-source license.

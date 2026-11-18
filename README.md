# ThoeneFit Rivals

**Challenge your friends, whatever watch they wear.**

A planned cross-platform fitness competition app for iPhone and Android. Compete with friends across supported wearables using customizable challenges and personalized activity goals.

> **Status:** Planning / pre-alpha. No native health integrations or watch apps are implemented yet.

## Vision

- Cross-platform competitions across Apple Watch, Pixel Watch, Galaxy Watch, and eventually other supported devices.
- Start with active calories and steps; keep scoring configurable.
- Support goal percentages, weighted metrics, and competition-specific rules.
- Private challenges, leaderboards, trophies, and bragging rights.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Windows development](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [GitHub Issues backlog](../../issues)

## Development workflow

- `main`: stable reviewed releases.
- `staging`: integration and testing.
- `feature/<issue>-short-name`: feature branches targeting `staging`.
- Promote tested work from `staging` to `main` via pull request.
- Track future fixes and resolved work in GitHub Issues.

## Privacy and licensing

Health data is sensitive. Explicit permissions, data minimization, access controls, deletion, and privacy documentation are prerequisites for beta. Never commit real health records or secrets.

License undecided. This repository is private and does not currently grant an open-source license.

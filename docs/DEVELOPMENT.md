# Development (Windows-first)

## Prerequisites

- Windows 11, Git, Node.js LTS, a supported package manager, and VS Code.
- Android Studio / Android SDK for local Android development.
- Expo CLI / EAS CLI as needed for development builds.
- An actual iPhone and Android device for health integration testing; an Apple Watch and Pixel Watch are useful for end-to-end validation.

## Suggested bootstrap (not yet run)

Initialize the Expo TypeScript application in `apps/mobile` on a feature branch. Prefer reproducible pinned dependency versions and commit the lockfile. Add lint, typecheck, unit tests, and a CI workflow. Do not commit credentials, signing certificates, health data, or API secrets.

## iOS limitations

Windows can edit shared React Native code and use cloud iOS builds, but Xcode and local iOS simulators require macOS. Native health bridges require development builds, not Expo Go. iOS device signing and external beta distribution may require Apple Developer Program enrollment.

## Branches

Create feature branches from `staging`, open PRs back into `staging`, run tests, and promote tested work to `main` through a separate PR.

## Release gates

No production health data or public distribution until permissions, privacy policy, security, data deletion, and real-device sync are validated.

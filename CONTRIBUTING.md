# Contributing to ThoeneFit Rivals

This repository is private and is developed mainly by Claude Code, with the project owner reviewing
and approving. These conventions keep the work traceable.

## Issues

- Every feature, bug, or chore gets its own issue (use the templates), with acceptance criteria.
- Add it to [master backlog #1](https://github.com/levitatedd/thoenefit-rivals/issues/1) in the
  right priority section (**Next**, **Planned**, **Later**). Never close or repurpose #1.
- Priority (the backlog section) and work status (the Project board column) are different things.

## Branches

Two permanent branches; everything else is a short-lived branch **created from `staging`** with a
PR **into `staging`**. The prefix decides how the change appears in the release notes.

| Branch                          | Purpose / release-notes category                                              |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `main`                          | Stable, reviewed releases. Changes only by an owner-approved promotion PR.    |
| `staging`                       | Integration and testing. All work PRs target this.                            |
| `feature/<issue>-short-name`    | **New** — a new user-facing capability.                                       |
| `improve/<issue>-short-name`    | **Improved** — polish or enhancement of something that already exists.        |
| `fix/<issue>-short-name`        | **Fixed** — a bug fix.                                                        |
| `chore/<issue>-short-name`      | Omitted from user-facing notes — tests, docs, CI, tooling, maintenance.       |

Examples: `feature/2-scoring-engine`, `improve/3-leaderboard-ties`, `fix/41-dst-day-boundary`,
`chore/22-versioning-changelog`. If a branch was named wrongly, add one label
`category: new`, `category: improved`, `category: fixed` or `category: chore` to the PR instead
of renaming it.

## Commits

Use short, imperative [Conventional Commit](https://www.conventionalcommits.org/) prefixes:
`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`. Reference the issue
(`Refs #13`) in the body.

## Pull requests

1. Open a PR from the work branch into `staging`, filling in the PR template. **The PR title is
   the line users read in What's New**: write it as a plain-language outcome
   ("Add Step Battle daily scoring", "Fix steps counted twice after sync"), not as a commit
   message ("feat(scoring): …"). Issue links are added to the notes automatically.
2. Link the issue in the description: `Closes #N` (merge completes the issue) or `Refs #N`
   (related, stays open).
3. CI must be green: Linux checks, Windows checks, dependency audit. If a check cannot run,
   say why in the PR; don't call it ready.
4. Update the README / docs when behaviour, setup, configuration, or architecture changes.
5. Merging into `staging` with `Closes #N` closes the issue automatically, then move it to
   **Completed** in #1.

## Work status on the Project board

| Status          | How it gets there                                                                   |
| --------------- | ----------------------------------------------------------------------------------- |
| **Todo**        | New issues are added automatically (Project built-in workflow).                      |
| **In Progress** | Add the `status: in progress` label to the issue when work actually starts.         |
| **In Review**   | Automatic once a non-draft PR into `staging` links the issue and CI passes.         |
| **Done**        | Automatic when the linked PR merges into `staging` (or the issue is closed).        |

Details, limitations, and one-time setup: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#project-board-automation).

## Releases (`staging` → `main`)

Only with explicit owner approval, using the checklist and release summary in
[docs/RELEASING.md](docs/RELEASING.md). Versions and the changelog are prepared by tooling, not by
hand; see [docs/DEVELOPMENT.md → Versioning and Releases](docs/DEVELOPMENT.md#versioning).

## Never commit

Secrets, tokens, `.env` files, signing keys/certificates/keystores, or real health records.

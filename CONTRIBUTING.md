# Contributing to ThoeneFit Rivals

This repository is private and is developed mainly by Claude Code, with the project owner reviewing
and approving. These conventions keep the work traceable.

## Issues

- Every feature, bug, or chore gets its own issue (use the templates), with acceptance criteria.
- Add it to [master backlog #1](https://github.com/levitatedd/thoenefit-rivals/issues/1) in the
  right priority section (**Next**, **Planned**, **Later**). Never close or repurpose #1.
- Priority (the backlog section) and work status (the Project board column) are different things.

## Branches

| Branch                         | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `main`                         | Stable, reviewed releases. Changes only by promotion PR.   |
| `staging`                      | Integration and testing. All feature PRs target this.      |
| `feature/<issue>-short-name`   | One issue's work, branched from `staging`.                 |
| `fix/<issue>-short-name`       | Bug fixes, same rules as features.                         |

## Commits

Use short, imperative [Conventional Commit](https://www.conventionalcommits.org/) prefixes:
`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`. Reference the issue
(`Refs #13`) in the body.

## Pull requests

1. Open a PR from the feature branch into `staging`, filling in the PR template.
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
[docs/RELEASING.md](docs/RELEASING.md).

## Never commit

Secrets, tokens, `.env` files, signing keys/certificates/keystores, or real health records.

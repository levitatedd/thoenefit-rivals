# Claude Code — ThoeneFit Rivals

## Before making changes
- Read README.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT.md, and docs/ROADMAP.md.
- Read [master backlog #1](https://github.com/levitatedd/thoenefit-rivals/issues/1) and the specific issue being worked on.
- Never assume that the scoring formula or backend choice has been finalized.

## Project tracking
- GitHub Projects board: https://github.com/users/levitatedd/projects/4/views/1
- Project status vocabulary: **Todo**, **In Progress**, **In Review**, **Done** (when configured). New entries should start in **Todo**.
- The project auto-adds new open issues and pull requests; confirm actual board status before claiming it is updated.
- Do not confuse the Project **Todo** status with the master backlog's **Next** priority section. Priority and work status are different.

## Issue and backlog workflow
- #1 is the permanent master backlog. Never close or repurpose it.
- Create a separate issue for each feature, bug, or chore; add it to #1 in the appropriate priority section.
- When beginning work, move its entry from Next/Planned to In Progress in #1.
- When verified and merged, close the implementation issue and move its entry to Completed in #1, retaining its issue link.
- Keep the GitHub Projects board synchronized if one has been configured. Do not claim board changes unless verified.
- Board automation (see docs/DEVELOPMENT.md): add the `status: in progress` label when starting an issue; link issues in PR descriptions (`Closes #N` / `Refs #N`) so CI can move them to In Review and merges can close them. Confirm results in the workflow run's "Project board status" summary before claiming a board change.
- All resolved issues and future work should remain discoverable through GitHub Issues.

## Branch and review policy
- main = stable; staging = integration.
- Create short-lived branches from staging and open PRs targeting staging. Prefix = release-notes category: `feature/<issue>-…` (New), `improve/<issue>-…` (Improved), `fix/<issue>-…` (Fixed), `chore/<issue>-…` (tests, docs, CI, maintenance; omitted from user-facing notes). No other permanent branches.
- PR titles are user-facing release-note lines: plain-language outcomes ("Add Step Battle daily scoring"), not commit-style prefixes. Use a single `category: …` label to override a wrongly named branch.
- Versioning: the only version source is `apps/mobile/package.json`; never hand-edit versions or build numbers elsewhere. Bump only via `node .github/scripts/release/cli.js prepare` on a `chore/release-x.y.z` branch right before an owner-approved promotion; promotions into main use a merge commit. See docs/DEVELOPMENT.md → Versioning / Releases.
- Do not push or merge to main without explicit user approval.
- Report tests run, unresolved limitations, and the next recommended issue after each task.
- Stop for approval before moving to another issue.

## Mobile app commands
- App: `apps/mobile`. Install with `npm ci`; run `npm run check` (typecheck, lint, format, tests) before every PR.
- Add native packages with `npx expo install <package>`; dependency versions are pinned exactly.
- See `apps/mobile/AGENTS.md` for Expo-specific guidance.

## Engineering principles
- Windows-first React Native / Expo / TypeScript.
- Separate health data adapters from scoring and leaderboard logic.
- Active calories and steps are initial candidate metrics; scoring is configurable.
- Use simulated data until native permissions and real-device testing are implemented.
- Never commit secrets, signing assets, or real health records.
- No paid services or production deployments without explicit approval.

## Development ownership and autonomy
- The project owner is the product owner, not a programmer. Claude Code owns implementation end-to-end: code, architecture proposals, dependencies, tests, CI, documentation, and pull requests.
- Do not ask the owner to write code, manually edit source files, or debug development tools. Prefer automation and cloud builds where practical; avoid unnecessary local setup.
- Deliver a tested PR and, when feasible, an installable test build or clear preview instructions, not a list of programming chores.
- Request owner action only for unavoidable account setup, permissions, billing, signing, device installation, or acceptance testing. Give concise, exact steps.
- Never incur costs, make major architectural commitments, publish releases, or deploy production changes without explicit approval.
- Explain test evidence and limitations truthfully; AI-generated code still requires review, especially for health-data privacy and security.

## Pull request and release quality gates
- Every implementation PR must link its corresponding GitHub issue (for example, `Closes #15` when merging should close it, or `Refs #15` when it should remain open).
- Before requesting a merge, run the relevant lint, typecheck, automated tests, and build checks. All required CI checks must pass; if a check is unavailable or fails, explain why and do not claim the PR is ready.
- Update the README and relevant docs whenever user-facing features, installation, configuration, or architecture change. Keep the README accurate rather than duplicating the issue backlog.
- Never merge incomplete, unreviewed, or failing work into `main`. Use feature branches and `staging` for unfinished development; production promotion requires explicit owner approval.
- For each `staging` to `main` promotion, provide a concise release summary covering included issues/PRs, user-visible changes, tests performed, migrations or configuration changes, known limitations, and rollback considerations.

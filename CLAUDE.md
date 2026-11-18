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
- All resolved issues and future work should remain discoverable through GitHub Issues.

## Branch and review policy
- main = stable; staging = integration.
- Create feature branches from staging and open PRs targeting staging.
- Do not push or merge to main without explicit user approval.
- Report tests run, unresolved limitations, and the next recommended issue after each task.
- Stop for approval before moving to another issue.

## Engineering principles
- Windows-first React Native / Expo / TypeScript.
- Separate health data adapters from scoring and leaderboard logic.
- Active calories and steps are initial candidate metrics; scoring is configurable.
- Use simulated data until native permissions and real-device testing are implemented.
- Never commit secrets, signing assets, or real health records.
- No paid services or production deployments without explicit approval.

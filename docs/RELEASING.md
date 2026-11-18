# Promoting `staging` → `main`

`main` holds stable, reviewed releases. Promotion happens only with **explicit owner approval**.

## Checklist

1. All PRs intended for the release are merged into `staging`, and their issues are closed and
   listed under **Completed** in [master backlog #1](https://github.com/levitatedd/thoenefit-rivals/issues/1).
2. CI is green on the latest `staging` commit (the `push` run of the **CI** workflow).
3. The app runs from `staging` on at least one physical device (Expo Go is fine until native modules
   are added). Record the device and result.
4. `npm audit` was reviewed; no new critical advisories, and any new ones are in
   [docs/DEPENDENCY-AUDIT.md](DEPENDENCY-AUDIT.md) or a security issue.
5. README and docs match what is on `staging`.
6. No secrets, signing files, or real health data in the diff (`git diff main...staging --stat`).
7. Prepare the version and changelog: on a `chore/release-x.y.z` branch from `staging`, run
   `node .github/scripts/release/cli.js prepare --base origin/main --head origin/staging`, review
   the generated `CHANGELOG.md` entry, and merge that PR into `staging`. (Chore-only releases need
   no bump; the command says so.)
8. Open a PR from `staging` into `main` with the release summary below as its description. Paste
   the generated user-facing notes under **User-visible changes**. The **Release notes** check must
   pass.
9. The owner approves; merge with **Create a merge commit** (required: it marks the release
   boundary for the next changelog, and makes the release easy to revert).

## Release summary template

```markdown
## Release summary — <YYYY-MM-DD>

### Included
- #<issue> — <title> (PR #<pr>)

### User-visible changes
- <what the owner / testers will notice>

### Tests performed
- CI: <link to green run on staging>
- Devices: <device, OS, Expo Go / build, result>

### Migrations or configuration changes
- <new secrets, variables, settings, permissions — or "None">

### Known limitations
- <deferred items, open issues>

### Rollback
- Revert the merge commit on `main` (`git revert -m 1 <merge-sha>`) and open a PR; no data
  migrations are involved while the app uses simulated data only.
```

## Notes

- Workflows triggered by `issues`, `workflow_dispatch`, `schedule` or `workflow_run` run only from
  the default branch (`main`). Changes to them take effect after promotion.
- Tagging releases and store/TestFlight distribution are not set up yet and need owner approval.

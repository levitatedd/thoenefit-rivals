<!--
Target `staging` for feature work. Promotions from `staging` to `main` use docs/RELEASING.md instead.
-->

## Linked issue

Closes #<!-- issue number; use "Refs #N" instead if this PR should NOT close the issue -->

## Summary

<!-- What changed and why, in plain language. -->

## Test evidence

<!-- Commands run and results; device/emulator tests; screenshots for UI changes. -->

- [ ] `npm run check` passes in `apps/mobile` (typecheck, lint, format, tests)
- [ ] CI is green on this PR
- [ ] Device / emulator test (or reason it is not applicable):

## Checklist

- [ ] README / docs updated for any user-facing, setup, configuration, or architecture change
- [ ] No secrets, tokens, signing files, or real health data committed
- [ ] Health data stays simulated unless the linked issue says otherwise
- [ ] New dependencies added with `npx expo install` (native) and pinned; `npm audit` reviewed
- [ ] Master backlog #1 and the linked issue are up to date

## Known limitations / follow-ups

<!-- Anything not done, deferred, or needing owner action. Link follow-up issues. -->

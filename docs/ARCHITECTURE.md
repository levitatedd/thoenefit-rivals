# Architecture (proposed; mobile shell implemented)

## Stack

- Mobile: Expo SDK 58 / React Native 0.88 with TypeScript and Expo Router in `apps/mobile` (implemented, #15). Development builds will be needed for native integrations.
- Health-data boundary: adapters implement `ActivityDataSource` and emit normalized `DailyActivitySummary` records (`apps/mobile/src/features/activity`). Only a simulated adapter exists today.
- Scoring: pure TypeScript engine in `apps/mobile/src/features/scoring` (implemented, #2): versioned rules, locked goal snapshots, per-day 200-point cap, source-aware eligibility, provisional/grace/final phases, private fairness guidance. Spec: [SCORING.md](SCORING.md).
- Demo (#3): `apps/mobile/src/features/demo` builds a simulated world (five invented players, a live Step Battle and a finished Calorie Clash) and scores it with the real engine. Demo Scoring Settings pass a demo-only rules object to these competitions; `RULES_V1` is never modified. In-memory only: nothing is stored or sent.
- Backend: Supabase is the initial candidate for authentication, PostgreSQL, and access control; evaluate before committing.
- iOS: HealthKit via an audited native bridge. Apple Watch data normally syncs through the paired iPhone.
- Android: Health Connect via native bridge. Availability of calories and steps depends on device, source app, permissions, and sync.
- Watch apps: future separate watchOS and Wear OS companions; not required for the first phone MVP.

## Data flow

Watch / tracker -> platform health store -> permissioned phone adapter -> normalized daily activity summaries -> backend -> competition scoring and leaderboard.

Never assume every wearable writes every metric to the platform store. Test actual devices and provider compatibility.

## Scoring design

Competition definitions specify: metric ID, goal basis, cap, duration, timezone, tie rules, and scoring version. Store daily source summaries separately from computed scores. Goals and rules should be locked at competition start; make historical results reproducible.

Candidate metrics: active energy (kcal), step count, exercise minutes. Start with active energy and steps. v1 decision (#2, reaffirmed in #3): one metric per competition (Step Battle, Calorie Clash); steps and calories are never blended or weighted together.

## Integrity and privacy

- Deduplicate overlapping records and avoid double counting multiple providers.
- Handle delayed uploads, corrected data, missing permissions, timezone and daylight-saving changes.
- Use least-privilege health permissions, authenticated writes, row-level security, and server-side score validation.
- Minimize retention; distinguish public competition scores from private underlying health measurements.
- Provide consent, export/deletion workflows, and a documented privacy policy before beta.
- Consider goal manipulation and manually entered health records in anti-cheat policy.

## Open questions

- Whether goals are user-selected, derived from recent history, or imported from device settings.
- Daily score caps, weighting, and whether scoring uses raw totals or goal percentages.
- Competition start/end times and cross-timezone rules.
- Which providers beyond Apple Health / Health Connect merit direct integrations.
- Whether Supabase or a self-hosted API is best for launch.

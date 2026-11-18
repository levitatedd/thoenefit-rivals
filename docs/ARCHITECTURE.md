# Architecture (proposed, not yet implemented)

## Stack

- Mobile: Expo / React Native with TypeScript, using development builds for native integrations.
- Scoring: pure TypeScript package with deterministic unit tests and versioned competition rules.
- Backend: Supabase is the initial candidate for authentication, PostgreSQL, and access control; evaluate before committing.
- iOS: HealthKit via an audited native bridge. Apple Watch data normally syncs through the paired iPhone.
- Android: Health Connect via native bridge. Availability of calories and steps depends on device, source app, permissions, and sync.
- Watch apps: future separate watchOS and Wear OS companions; not required for the first phone MVP.

## Data flow

Watch / tracker -> platform health store -> permissioned phone adapter -> normalized daily activity summaries -> backend -> competition scoring and leaderboard.

Never assume every wearable writes every metric to the platform store. Test actual devices and provider compatibility.

## Scoring design

Competition definitions specify: metric IDs, goal basis, weights, cap, duration, timezone, tie rules, and scoring version. Store daily source summaries separately from computed scores. Goals and rules should be locked at competition start; make historical results reproducible.

Candidate metrics: active energy (kcal), step count, exercise minutes. Start with active energy and steps. Combined metrics overlap; disclose this and let organizers adjust weights. Avoid forcing a final scoring formula in v1.

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

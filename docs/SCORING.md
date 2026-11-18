# Scoring engine (v1)

Code: [`apps/mobile/src/features/scoring`](../apps/mobile/src/features/scoring). The specification
and product decisions are in issue [#2](https://github.com/levitatedd/thoenefit-rivals/issues/2).
The engine is pure TypeScript (no React Native, network, storage, or health-platform imports) so it
can later move to a shared package or a server unchanged.

## Competitions

| Category          | Metric             | Unit                            |
| ----------------- | ------------------ | ------------------------------- |
| **Step Battle**   | `steps`            | steps                           |
| **Calorie Clash** | `activeEnergyKcal` | active kcal (not resting/total) |

One primary metric per competition. Steps and calories are **never** added together. No
smartwatch is required; phone-only participation works whenever the metric is available.

## Points

```
daily points = min(200, 100 × eligible daily activity ÷ locked personal daily goal)
competition points = sum of the individually capped daily points
```

- Goals are personal and must be finite and > 0. Easy goals are allowed (see fairness).
- Each participant's goal is **locked at the start** (a frozen copy); editing the profile goal
  later never changes an active or finished competition.
- **Precision:** each day is rounded half-up to 0.01 points and stored as an integer number of
  hundredths ("centi-points"). Totals are exact integer sums; **ranking uses centi-points**, so it
  never depends on floating-point drift. Screens may round to whole points for display.
- **Ranking:** total points, highest first. Exact ties share a place (1, 1, 3). Withdrawn players
  keep their earlier days, are marked withdrawn, and are not ranked.
- Every result stores the **rules version** (`v1`), the full rules, and each goal snapshot, so
  future rule changes can't rewrite history.

## Days, time zones and timing

- Each competition declares **one IANA time zone**. A competition day is
  `[local 00:00, next local 00:00)`, so 23- and 25-hour daylight-saving days are handled.
- A record belongs to the competition day that contains it. The window starts at local midnight
  of the first day (inclusive) and ends at local midnight after the last day (exclusive); a record
  ending exactly at midnight does not cross into the next day.
- **v1 limitation — records spanning a day boundary are held, never split.** A sample that crosses
  local midnight (or the competition start/end) is held as `SPANS_DAY_BOUNDARY` with an
  explanation; the rest of the day still counts. We don't invent a proportional split, because the
  source data doesn't say when within the interval the activity happened. Requirement for #6 and
  the health adapters (#4, #5): supply records already bounded to competition days in the
  competition's time zone (daily aggregates or day-sliced samples from the platform).
- Participants must **join before the start**; no late entry or retroactive points in v1.
- **Phases:** `not-started` → `in-progress` → `grace` (24 h after the end) → `final`. Scores are
  provisional until `final`.
- **Missing data is not zero.** Each day is `confirmed` (synced through the end of the day; a 0
  here is real), `pending` (in progress or not fully synced), `permission-revoked`, `future`,
  `withdrawn`, or — once final — `no-data`.
- Activity must have **happened** inside the window. Records **received** during the grace period
  still count; records received after `finalizesAt` (end + 24 h) are excluded as `LATE_SYNC`, so a
  final result never changes when recomputed later.

## Which activity counts

Records come from health adapters with provenance (source kind, platform, recording method,
device/app id). Provenance is platform metadata, **not proof** of real activity: these rules
prevent accidental double counting and manual entries, not deliberate tampering.

| Reason                | Result   | When                                                                                           |
| --------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `INVALID_RECORD`      | excluded | negative/nonfinite value, broken timestamps, unknown participant                               |
| `UNSUPPORTED_METRIC`  | excluded | metric isn't the competition's metric                                                          |
| `LATE_SYNC`           | excluded | received after the finalization deadline                                                       |
| `OUTSIDE_COMPETITION` | excluded | entirely outside the competition window                                                        |
| `SPANS_DAY_BOUNDARY`  | **held** | crosses a competition-day boundary, incl. the competition start/end (v1 limitation, see above) |
| `MANUAL_ENTRY`        | excluded | the platform marks it as manually entered                                                      |
| `DUPLICATE_ACTIVITY`  | excluded | **confirmed** duplicate only — see below; also workout totals (already inside daily activity)  |
| `UNKNOWN_SOURCE`      | **held** | unidentifiable source, or a third-party import without app provenance                          |
| `OVERLAP_UNRESOLVED`  | **held** | overlaps a counted record from a different source, with no evidence it is the same activity    |

**Duplicates need evidence. Overlapping timestamps alone are not proof of duplication.** A record
is excluded as `DUPLICATE_ACTIVITY` only when:

1. it is the same record again (same id), or an identical copy from the same source;
2. it shares an `activityId` with another record — the same underlying activity reaching the
   health store through several sources (e.g. a provider import carrying the original record's
   id). The highest-priority copy counts (watch > phone > import > unknown);
3. the day has a daily total the platform **guarantees is de-duplicated across sources**
   (`aggregation: 'platform-deduplicated'`, e.g. HealthKit statistics / Health Connect aggregate):
   that total counts and covers every other record that day. Totals are **not** assumed to be
   de-duplicated: a `single-source` total (one app's own count) or a total with no aggregation
   claim gets no precedence.

Anything else that overlaps a counted record from a _different_ source is **held** as
`OVERLAP_UNRESOLVED` with a plain-language explanation, rather than excluded or added: it might be
the same activity, or a genuinely separate one. Which record counts is deterministic (higher source
priority, then earlier start, then record id). Overlap within a single source is not treated as
duplication. Held records never block the rest of the day's valid activity, and phone + watch
totals are never blindly summed.

Adapters (#4, #5, #6) may only set `activityId` and `aggregation` from real platform/provider
metadata — never inferred from overlapping times.

## Fairness guidance (private, advisory)

Warn, never penalize: guidance never changes points, never blocks joining, never auto-adjusts
goals. It is shown only to the goal owner; other players see goals and scores, not history
(`toPublicStandings`).

- **Baseline:** median of the last 28 calendar days. Genuine zero days count; days with no data
  are missing, not zero. 14+ valid days = normal, 7–13 = provisional ("rough guide"), < 7 =
  insufficient.
- **Bands** (goal ÷ baseline): < 60% potentially easy · 60–< 90% below usual · 90–110% near
  usual · > 110% above usual (narrowed from 80–120% after #14; #31). The messages explain the
  trade-off: a lower goal makes points easier to earn, a higher goal makes each point harder. Zero baseline, insufficient history and missing permission each get
  their own explicit result.
- Assessed **once at competition start** and stored with the participant.
- **Future-goal suggestion:** after ≥ 3 capped (200-point) days in a 7-day competition, suggest
  about +10% (rounded to 100 steps / 10 kcal) for **future** competitions only. Other lengths use
  `max(2, ceil(days × 3/7))`. At most one per competition result.

All "proposed" thresholds live in `RULES_V1` (`rules.ts`) and are meant to be tuned through
playtesting. Simulation results and recommendations: [SCORING-VALIDATION.md](SCORING-VALIDATION.md) (#14).

## API

```ts
import {
  startCompetition,
  scoreCompetition,
  toPublicStandings,
} from "@/features/scoring";

const competition = startCompetition({
  id,
  categoryId: "step-battle",
  timeZone,
  startDate,
  endDate,
  participants,
});
const result = scoreCompetition(
  competition,
  activityRecords,
  syncStates,
  new Date().toISOString(),
);
const leaderboard = toPublicStandings(result); // safe to show to other participants
```

## Not in this issue (follow-ups)

- Health adapters producing `ActivityRecord`s with real provenance: #4 (HealthKit), #5 (Health
  Connect), #6 (ingestion and sync, incl. `SyncState`). They must supply day-bounded records in the
  competition time zone, and set `activityId` / `aggregation` only from real platform metadata.
- Resolving held records (`OVERLAP_UNRESOLVED`, `SPANS_DAY_BOUNDARY`, `UNKNOWN_SOURCE`) with better
  provenance from the adapters, or a review flow: follow-up with #6.
- Leaderboard and competition screens: #3 (simulated demo; Demo Scoring Settings affect demo competitions only).
- Persistence, accounts, and any server-side verification: #7, #8; anti-cheating policy: #10.
- Simulated validation of the rules: #14 → [SCORING-VALIDATION.md](SCORING-VALIDATION.md). Real-world playtesting comes later.

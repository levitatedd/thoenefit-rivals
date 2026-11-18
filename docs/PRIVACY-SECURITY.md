# Privacy, security and anti-cheating requirements (#10)

**Status:** requirements and design; **owner decisions recorded 2026-11-18** (see the
[decision log](#8-decision-log)). **Nothing in this document is implemented yet**, apart from the
scoring-engine rules already merged in #2. **Approved** items are owner decisions. **Proposed**
items are requirements that become binding when this document is merged. The points formula is
unchanged. The approved easy-goal changes ([Section 5](#5-easy-goals-options-for-a-decision)) are
implemented in their own follow-up issues.

Inputs: the scoring specification ([#2](https://github.com/levitatedd/thoenefit-rivals/issues/2),
[SCORING.md](SCORING.md)), the simulation findings ([#14](https://github.com/levitatedd/thoenefit-rivals/issues/14),
[SCORING-VALIDATION.md](SCORING-VALIDATION.md)), the architecture ([ARCHITECTURE.md](ARCHITECTURE.md)), the
ingestion requirements on [#6](https://github.com/levitatedd/thoenefit-rivals/issues/6), and the
competition and invitation scope in [#8](https://github.com/levitatedd/thoenefit-rivals/issues/8).

Requirement IDs (for example `ACC-3`) are referenced from implementation issues and tests.

## Contents

1. [Principles and threat model](#1-principles-and-threat-model)
2. [Accounts](#2-accounts)
3. [Competitions, friends and invitations](#3-competitions-friends-and-invitations)
4. [Health data: what we store, consent, permissions and deletion](#4-health-data)
5. [Easy goals: options for a decision](#5-easy-goals-options-for-a-decision)
6. [Anti-cheating](#6-anti-cheating)
7. [Release gates](#7-release-gates)
8. [Decision log](#8-decision-log)

---

## 1. Principles and threat model

### Principles

1. **Trusted friends, honestly described.** v1 serves private groups of people who know each other
   (#2). We prevent accidents and casual cheating, and we never claim that activity is "verified"
   or that cheating is impossible.
2. **Minimum health data.** Store only the daily totals needed to score competitions, never raw
   samples or unrelated health types.
3. **The server decides scores.** Phones submit activity totals with their source information. The
   server runs the same scoring engine and is the only writer of standings (see `CHT-1`).
4. **Private by default.** Other players see goals and points only. History, raw activity, held
   records and goal advice belong to their owner (as implemented in #2 and #3).
5. **Don't punish beginners.** Fairness rules compare players with **their own** usual activity,
   never with an absolute standard.
6. **Explain everything.** Every held or excluded record, and every rule, has a plain-language
   explanation.

### Who and what we protect against

| Actor                                     | Goal                                                  | Main mitigations                                                                      |
| ----------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Competitive friend                        | Win unfairly: easy goal, manual entries, edited data  | Goal options (Section 5), manual-entry exclusion, provenance, daily cap, server scoring |
| Curious participant                       | See someone's health history                          | Public standings contain goals and points only; server authorization (`CMP-2`)         |
| Stranger                                  | Join or view a private competition                    | Unguessable, expiring, revocable invites; no enumeration (`INV-1`–`INV-6`)               |
| Someone holding a lost or shared phone    | Act as the owner                                      | Device-level auth, short sessions, remote sign-out (`ACC-4`, `ACC-5`)                     |
| Malicious app on the user's phone         | Write fake activity to Apple Health / Health Connect  | Source provenance and holds; the cap bounds the damage; documented limitation (`CHT-4`) |
| Attacker on the backend or network        | Steal or alter data                                   | TLS, row-level security, least privilege, secrets management, audit log (`SEC-*`)      |
| Our own operations (insider, logs, crash reports) | Accidental exposure                           | No health values in logs or analytics; access controls; retention limits (`DAT-6`)     |

**Assets:** daily activity totals and provenance, goals and fairness bands, identity (email,
sign-in provider id), display names, friend lists and competition membership, invite tokens, and
consent records.

**Out of scope for v1:** proving physical effort, detecting a rooted or jailbroken device,
stopping someone who wears another person's phone or watch, and moderating user-uploaded images
(only bundled artwork is planned; see #8).

---

## 2. Accounts

| ID      | Requirement                                                                                                                                                                                                                                         | Status   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `ACC-1` | Sign in with **Sign in with Apple**, **Google**, or an **email one-time link or code**. We never store passwords. The provider choice is made in #7. Sign in with Apple is mandatory on iOS whenever another social login is offered. | Proposed |
| `ACC-2` | **Minimal profile:** display name (any nickname) and optional bundled avatar. No real name, birthday, gender, weight or phone number. The email address is used for sign-in only and is never shown to other users.                                    | Proposed |
| `ACC-3` | **Age:** testers and users must be **18+** for beta (health data plus minors adds legal duties). Self-declared at sign-up; revisit before any public launch.                                                                                 | **Approved** |
| `ACC-4` | **Sessions:** short-lived access tokens with rotating refresh tokens, stored only in the platform keychain/keystore (`expo-secure-store`), never in plain storage or logs.                                                                       | Proposed |
| `ACC-5` | **Sign out everywhere** and revoke all sessions from settings; sessions are also revoked on account deletion.                                                                                                                                      | Proposed |
| `ACC-6` | **Rate limiting** on sign-in, invite redemption and data upload; generic error messages that don't reveal whether an email address has an account.                                                                                                | Proposed |
| `ACC-7` | **In-app account deletion** that is easy to find (Apple requires this). See `DEL-*` for what is deleted.                                                                                                                                              | Proposed |

---

## 3. Competitions, friends and invitations

Builds on the #8 scope: private, invite-only competitions, one metric each, scored with #2's rules.

### Access

| ID      | Requirement                                                                                                                                                                                       | Status   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `CMP-1` | **Server-side authorization on every read and write** (for example Postgres row-level security), with automated tests proving that non-members get nothing: no name, member list or leaderboard. | Proposed |
| `CMP-2` | Other participants receive **public standings only** (goal, daily points, total, rank, day status), never activity amounts, history, held/excluded records or goal advice. This matches `toPublicStandings` in #2. | Proposed |
| `CMP-3` | **Rules and goals lock at the start** on the server. Afterwards, the competition settings, metric, dates and each goal snapshot cannot be changed by anyone, including the organizer.                      | Proposed |
| `CMP-4` | The organizer can manage invitations and remove a participant before the start. After the start, removal marks the participant as withdrawn (#2 behaviour). The organizer **cannot** see other players' private data. | Proposed |
| `CMP-5` | The demo-only scoring settings from #3 are **never** available in real competitions (#8).                                                                                                          | Proposed |
| `CMP-6` | **Joining shows** the rules, the metric, the dates and time zone, and exactly what other participants will see about you, before you accept.                                                                     | Proposed |

### Invitations

| ID      | Requirement                                                                                                                                       | Status   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `INV-1` | Invite tokens are **random, at least 128 bits**, tied to one competition, and stored hashed on the server.                                                                    | Proposed |
| `INV-2` | Invites **expire** (default 7 days, and never after the competition starts), can be **revoked**, and stop working once the competition is full.          | Proposed |
| `INV-3` | Invite links and codes contain **no personal or health information** (no names or competition details in the URL).                                         | Proposed |
| `INV-4` | **No enumeration:** invalid, expired, revoked and full invites return the same generic error, and redemption is rate-limited.                                          | Proposed |
| `INV-5` | A link alone does not join anyone: the user must be signed in and **explicitly accept** (`CMP-6`).                                                 | Proposed |
| `INV-6` | **Friends without contact upload:** v1 finds friends through invite links/codes only. No address-book upload and no public user search. Users can block someone, which hides them and stops invitations from them. | Proposed |

### General security

| ID      | Requirement                                                                                                                                                                       | Status   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `SEC-1` | TLS everywhere, with no plain HTTP. The backend encrypts data at rest and in backups (standard for hosted Postgres).                                                                                 | Proposed |
| `SEC-2` | Secrets only in the platform secret store or CI secrets, never in the app bundle or repository. The app holds only public client keys, protected by row-level security.                        | Proposed |
| `SEC-3` | Least-privilege database roles; the service role is used only by server functions, never by the app.                                                                                        | Proposed |
| `SEC-4` | Dependency and secret scanning in CI (the audit already exists; see #17) and pinned dependencies.                                                                                                 | Proposed |
| `SEC-5` | A short **security review** of the threat model before beta, plus an incident contact address and a basic response plan (who is told, how fast, how to revoke sessions).                                   | Proposed |

---

## 4. Health data

### 4.1 What we store, and what we don't

Health information is processed **on the phone first**. Only the minimum leaves the device.

| Data                                                                                                     | Where                          | Why                                         | Who sees it                               | Kept for                    |
| -------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------- | ----------------------------------------- | --------------------------- |
| **Daily total per competition day and metric** (steps *or* active kcal, only for days of competitions you joined) | Server                         | Scoring                                     | You. Others see only the resulting points. | See `DAT-5`                 |
| **Source summary** per daily total: source kind (phone/watch/import), platform, recording method, the platform's de-duplication flag, `activityId` when provided | Server                         | Eligibility rules (#2)                      | You (reasons for held/excluded records)   | Same as the daily total     |
| **Eligibility decisions** (reason codes)                                                                 | Server                         | Explanations                                | You                                       | Same as the daily total     |
| **Goal snapshot** per competition                                                                        | Server                         | Scoring                                     | Participants of that competition          | Same as competition results |
| **Fairness result at start** (band + history sufficiency; the usual-day number only if Option C in Section 5 is chosen) | Server                         | Private advice / fair-goal mode             | You (and a neutral label to others if Option B is chosen) | Same as competition results |
| **Sync state** (synced-through time, permission granted or not)                                          | Server                         | Pending vs. zero days                       | You; others see "waiting for sync"        | Same as competition results |
| **28-day history** used for the usual-day baseline                                                       | **Phone only**, computed on demand | Fairness advice                         | Nobody                                    | Not stored                  |

**Never collected or stored:** individual samples or timestamps finer than a day, heart rate,
workouts, routes or location, sleep, weight, body measurements, medical records, other health
types, or activity outside the competitions you joined.

| ID      | Requirement                                                                                                                                                                                                                       | Status          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `DAT-1` | Request **read-only** access to **steps** and **active energy** only, never write access.                                                                                                                                            | Proposed        |
| `DAT-2` | Upload only the rows in the table above. Uploads are keyed by (participant, competition, day, metric), so a re-upload **replaces** the previous value and never adds to it.                                                                        | Proposed        |
| `DAT-3` | Health data is used **only** to run competitions. No advertising, profiling, selling or sharing with third parties, and no third-party analytics or ads SDKs. Required by the Apple HealthKit and Google Health Connect policies. | Proposed        |
| `DAT-4` | Health values never appear in **logs, crash reports or error messages**; crash reporting (if added) scrubs payloads.                                                                                                               | Proposed        |
| `DAT-5` | **Retention:** the daily totals and source summaries of a competition are kept until **30 days after it is final**, then deleted automatically; only points, ranks and goal snapshots remain for history (#9). The user can delete earlier (`DEL-*`). | **Approved** (30 days) |
| `DAT-6` | Operator access to production health rows is restricted and logged; no bulk exports.                                                                                                                                                | Proposed        |
| `DAT-7` | The app caches health data only as needed to show the current screens, in app-private storage; it is cleared on sign-out.                                                                                                                       | Proposed        |

### 4.2 Permissions and consent

| ID      | Requirement                                                                                                                                                                                                                                                                                                                         | Status   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `CON-1` | **Just-in-time permission:** ask for steps or active energy access only when the user joins their first competition that needs that metric. Before the system prompt, show a short screen explaining what is read, what is uploaded and who sees what.                                                                                         | Proposed |
| `CON-2` | **Separate, explicit consents**, each recorded with a version and timestamp: (a) processing your daily totals to run competitions you join (required to compete); (b) sharing your goal and points with each competition's participants (given when you join that competition). No optional analytics consent in v1, because there are no analytics. | Proposed |
| `CON-3` | **Withdrawing consent or revoking the OS permission** stops uploads. Affected days show "No permission" (#2's `permission-revoked`) rather than zero, and the user is offered `DEL-2`.                                                                                                                                                | Proposed |
| `CON-4` | iOS doesn't tell apps whether read access was denied. Treat "no data" as unknown (never as a confirmed zero) and explain how to check the setting in the Health app.                                                                                                                                                           | Proposed |
| `CON-5` | A **privacy policy** written in plain language and linked from sign-up, the permission screen and settings. It is required by Apple, Google (Health Connect declaration and Data safety form) and most privacy laws.                                                                                                                             | Proposed |
| `CON-6` | **Legal check:** health data is "special category" data under GDPR (explicit consent), and US state laws such as Washington's My Health My Data Act apply. A paid legal review of the privacy policy and consent wording is **not approved for now**. Until then, keep testing to the owner's own circle, avoid marketing to EU users, and revisit before any public launch. | **Deferred** by owner |

### 4.3 Deletion and export

| ID      | Requirement                                                                                                                                                                                                                                                                                                                         | Status          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `DEL-1` | **Delete account** (in-app; `ACC-7`): signs out everywhere immediately, and deletes the profile, friends, invitations, consents and **all** health rows within **30 days**, including backups as they rotate.                                                                                                                                  | Proposed        |
| `DEL-2` | **Delete my health data** while keeping the account: removes all daily totals, source summaries and decisions. Competitions in progress then show your days as "no data".                                                                                                                                                                 | Proposed        |
| `DEL-3` | **Leaving a competition** before the start deletes your membership and any data for it. After the start you are marked withdrawn (#2), and your health rows for it can be deleted with `DEL-2`.                                                                                                                                            | Proposed        |
| `DEL-4` | **Effect on other players' results** after deletion: in **final** competitions, keep the deleted user's points and rank under the name **"Former participant"**, with no health data, so other people's places don't change. In unfinished competitions, remove them entirely. | **Approved** |
| `DEL-5` | **Export my data** as a JSON file in the app (profile, competitions, goals, daily totals, consents).                                                                                                                                                                                                                                  | Proposed        |

---

## 5. Easy goals: options for a decision

**No scoring behaviour changes until the owner chooses.** The formula (100 points at 100% of
your own goal, 200-point daily cap) is kept in every option below.

### What #14 found, plus extra simulations for this decision

One player sets a goal at a fraction of their usual day, against three honest players of the
same fitness level (400 simulated competitions each; a fair share is 25%):

| Goal as a share of your usual day | 3-day win share | 7-day win share |
| --------------------------------- | --------------: | --------------: |
| 50% (easy)                        |           99.0% |          100.0% |
| 70%                               |           87.5% |           96.5% |
| 80%                               |           60.3% |           80.8% |
| 86%                               |           49.0% |           67.8% |
| 90%                               |           44.0% |           48.0% |
| 95%                               |           32.8% |           32.8% |
| 100% (honest)                     |           27.3% |           24.0% |

The 50%, 70% and 100% rows come from [SCORING-VALIDATION.md](SCORING-VALIDATION.md); the 80–95%
rows were run for this review with the same simulator and seeds.

**What this means:** small under-goals add up over a week. Even 90% of a usual day doubles the
chance of winning. A minimum-goal floor below about 95% therefore only partly helps. Personal
goals themselves work well: with honest goals, a light walker and an athlete win equally often.
The weak point is choosing the goal, not the formula.

### Options

| Option                                                         | How it works                                                                                                                                                                                                                                                                     | Effect on beginners                                                            | Effect on easy-goal gaming                                                                                       | Changes #2?                                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **A. Keep as is**                                              | Anyone picks any goal; private warning only.                                                                                                                                                                                                                                     | None                                                                           | None: a 50% goal wins ~100% of weeks                                                                               | No                                                                                      |
| **B. Neutral goal label for everyone**                         | Each participant's leaderboard row shows a neutral label: "Goal near usual", "Goal below usual", "Goal above usual" or "New to tracking". No numbers or history are shown. Disclosed at join (`CMP-6`).                                                                        | None: compared with their own usual day                                        | Social pressure only; doesn't change results                                                                       | Yes: #2 keeps fairness private unless opt-in. Covered by consent at join.               |
| **C. "Usual-day goals" competition mode** _(recommended)_       | The organizer chooses this mode at creation (#8). Each goal is set automatically to the player's **own usual day** (28-day median, rounded). Players may **raise** their goal but not lower it. With fewer than 7 days of history, the player picks a goal, labelled "New to tracking". | None: a 3,000-step walker gets a 3,000-step goal                               | Strong: under-goals become impossible; gaming needs weeks of deliberately lower activity beforehand                   | Yes: in this mode, goals are no longer freely chosen and easy goals are blocked.        |
| **D. Organizer minimum (relative)**                            | The organizer sets "goal at least 80%/90% of your usual day".                                                                                                                                                                                                                    | None (relative)                                                                | Partial: 90% still wins 48% of weeks                                                                                | Yes (blocks some easy goals)                                                            |
| **E. Clearer private advice**                                  | Narrow "near usual" from 80–120% to **90–110%**, and reword "above usual" to explain the trade-off ("a higher goal makes each point harder to earn").                                                                                                                                 | None                                                                           | Small: better self-awareness                                                                                       | Thresholds only (advisory, no score effect)                                             |
| F. Hidden scoring floor _(not recommended)_                    | Score against max(goal, X% of usual) without telling the player.                                                                                                                                                                                                                 | None                                                                           | Partial                                                                                                            | Yes, and it's opaque. Rejected: it breaks "explain everything".                        |

### Decision (owner, 2026-11-18): E + C + B, never penalizing limited history

1. **E: clearer private advice.** The "near usual" band narrows to **90–110%** and the "above usual" advice is reworded. Advisory only; points unaffected.
2. **C: "Usual-day goals" competition mode, the default** when creating a competition (#8). With **reliable history**, a player's goal is set to their own usual day (28-day median, rounded to 100 steps / 10 kcal). They may raise it but not lower it.
3. **B: neutral goal labels** shown to all participants in "Choose your own goals" (casual) competitions.
4. **No automatic penalty for limited history.** "Reliable history" means at least **14 valid days** in the last 28 (#2's "normal" sufficiency; missing days are never counted as zero). Anyone with less, including new users, a new phone, or a permission granted recently, **chooses their own goal** in either mode. The app suggests their usual day when it can estimate one. They are labelled neutrally as **"Limited history"**, never as below usual, and their points are calculated exactly like everyone else's. The 14-day threshold is configurable and can be raised (for example to 21) if testing shows it's too lenient.

Implementation follows in separate issues: E in [#31](https://github.com/levitatedd/thoenefit-rivals/issues/31) (advisory bands and wording) and C + B in [#32](https://github.com/levitatedd/thoenefit-rivals/issues/32) (competition goal modes: engine, simulation and demo done; the creation and join screens come with #8). Details: [SCORING.md → Goal modes](SCORING.md#goal-modes-32). The points formula and the 200-point cap stay as agreed in #2.

### Original recommendation (for reference)

1. **E now** (advisory wording and bands only; no effect on points).
2. **C as a competition mode** in #8, chosen by the organizer: "Usual-day goals (fairest)" vs.
   "Choose your own goals (casual)". **Default: Usual-day goals.**
3. **B always on** in "Choose your own goals" competitions, so everyone can see whether goals are
   comparable without seeing anyone's history.

This keeps personal, relative goals (so beginners and less-active people compete on equal terms),
removes the main exploit for groups that want a fair contest, and keeps casual groups flexible and
transparent. Data impact: Option C uploads one number per player per competition (their usual
day) so the server can enforce the floor; the 28-day history itself stays on the phone (Section 4.1).

**Not decided here:** the exact rounding of usual-day goals (proposed: 100 steps / 10 kcal), and
whether players with 7–13 days of history ("provisional") get usual-day goals (proposed: yes, with
a "rough guide" label).

---

## 6. Anti-cheating

What we can and can't stop, stated honestly. The **200-point daily cap** is the backbone: whatever
happens on one day, it is worth at most two "goal days".

| ID      | Threat                                         | Requirement                                                                                                                                                                                                                                                                                                                               | Status   |
| ------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `CHT-1` | **Client-submitted scores**                    | The server **never accepts points, ranks or totals** from the app. The app uploads daily totals with source summaries; the server runs the scoring engine (the same TypeScript package as #2) and is the only writer of standings. Rules version and goal snapshots live on the server.                                                         | Proposed |
| `CHT-2` | **Back-dated or late uploads**                 | `receivedAt` is set by the **server**, never by the app. Uploads after `finalizesAt` are excluded (`LATE_SYNC`), so final results never change. Activity must have occurred inside the competition window.                                                                                                                          | Proposed |
| `CHT-3` | **Manually entered activity and workouts**     | Excluded (`MANUAL_ENTRY`). Adapters map HealthKit `HKMetadataKeyWasUserEntered` and Health Connect `recordingMethod = MANUAL_ENTRY`. Workout totals are never added on top of daily totals (`DUPLICATE_ACTIVITY`). Tested per adapter (#4, #5).                                                                          | Proposed |
| `CHT-4` | **Manipulated records** (apps writing fake steps, edited data) | Not preventable on the phone. Mitigations: prefer **platform de-duplicated daily totals**; accept only identifiable automatic sources; hold unknown sources and imports without app provenance (`UNKNOWN_SOURCE`); and the daily cap. Stated plainly in the rules screen.                                                            | Proposed |
| `CHT-5` | **Implausible values**                         | **Hold** (not exclude) a day above a plausibility ceiling, so it doesn't count until it is resolved. Proposed ceilings: 100,000 steps/day or 5,000 active kcal/day. The owner sees a plain explanation and can re-sync. Held days are visible to the owner only.                                                                     | **Approved** |
| `CHT-6` | **Duplicate data**                             | The engine's evidence-based de-duplication (#2), plus idempotent uploads (`DAT-2`). Phone and watch totals are never summed blindly.                                                                                                                                                                                                         | Implemented in engine; upload part proposed |
| `CHT-7` | **Goal manipulation**                          | Goals lock server-side at the start (`CMP-3`). Easy goals: Section 5 (approved E + C + B).                                                                                                                                                                                                                                                                     | **Approved** (Section 5) |
| `CHT-8` | **Tampering with other players' data**         | Row-level security: a user can only write their own uploads, only for competitions they joined, and only for metrics that competition uses.                                                                                                                                                                                                  | Proposed |
| `CHT-9` | **Disputes**                                   | The server keeps an **audit log** of uploads (time, payload hash, source summary, decision; no health values) for 30 days, matching `DAT-5`, so the owner/support can explain a result. No automatic penalties or "cheater" labels.                                                                                                                                             | Proposed |

**Not attempted in v1:** device attestation (App Attest / Play Integrity), anomaly-based
penalties, and cross-checking against GPS. These can be added later without changing the
engine, because inputs, provenance, decisions and rule versions are already separate (#2).

---

## 7. Release gates

### Before real health integrations (#4, #5, #6 in development builds)

- [ ] `DAT-1`: read-only steps and active energy only; usage descriptions (iOS) and the permission declaration (Android) state the purpose.
- [ ] `CHT-3`: manual-entry and source mapping, with adapter tests; day-bounded records as required on #6.
- [ ] `DAT-4` / `DAT-7`: no health values in logs; minimal app-private cache.
- [ ] Data stays on the device until the backend (#7) exists. No uploads to any third party.
- [ ] Testing uses the developer's or owner's own data only. Health exports and screenshots containing real data are never committed.

### Before beta testing (anyone outside the core team)

- [ ] Backend and accounts (#7): `ACC-1`–`ACC-7`, `SEC-1`–`SEC-5`, `CMP-1` with authorization tests.
- [ ] Server-authoritative scoring and server `receivedAt`: `CHT-1`, `CHT-2`, `CHT-8`.
- [ ] Invitations: `INV-1`–`INV-6` (#8).
- [ ] Consent, permissions, privacy policy: `CON-1`–`CON-5`. A legal review (`CON-6`) is deferred by the owner, so keep beta to the owner's own circle.
- [ ] Deletion and export in the app: `DEL-1`–`DEL-5`.
- [ ] App Store privacy details and the Google Play Data safety form / Health Connect declaration completed.
- [ ] Easy-goal decision (Section 5: E + C + B, limited history never penalized) implemented.
- [ ] Age requirement (`ACC-3`) shown at sign-up.
- [ ] Security review (`SEC-5`) done, and the dependency audit (#17) reviewed.

---

## 8. Decision log

| #   | Decision                                                                            | Status                    |
| --- | ----------------------------------------------------------------------------------- | ------------------------- |
| D1  | Trusted-friends model; no claims of verified effort (#2)                            | Agreed (#2)               |
| D2  | Server-authoritative scoring; the app never submits scores (`CHT-1`)                | Proposed (binding on merge) |
| D3  | Store daily totals only; the 28-day history stays on the phone (Section 4.1)        | Proposed (binding on merge) |
| D4  | Easy goals: E (clearer advice) + C (usual-day goals, default mode) + B (neutral labels in casual mode); players with limited history (< 14 valid days) are never penalized (Section 5) | **Approved** 2026-11-18 |
| D5  | Health-data retention: **30 days** after a competition is final (`DAT-5`)          | **Approved** 2026-11-18   |
| D6  | Deleted users in finished competitions shown as "Former participant" (`DEL-4`)     | **Approved** 2026-11-18   |
| D7  | Beta testers 18+ (`ACC-3`)                                                         | **Approved** 2026-11-18   |
| D8  | Plausibility ceilings hold, not exclude (`CHT-5`)                                  | **Approved** 2026-11-18   |
| D9  | Paid legal review of the privacy policy and consent (`CON-6`)                      | **Deferred** (not approved for now); revisit before public launch |

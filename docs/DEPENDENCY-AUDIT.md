# Dependency audit — `apps/mobile`

**Audited:** 2026-11-18 · Expo SDK 58.0.26 · React Native 0.88.1 · `npm audit` (npm 10.9.9)
**Result:** 82 findings (6 moderate, 76 high, 0 critical). They come from **3 root advisories**,
all in build-time tooling. **None of the affected code ships in the app.** No fix is applied;
follow-up is tracked in
[issue #17](https://github.com/levitatedd/thoenefit-rivals/issues/17).

> The count was 81 during the first install; the extra entry appeared after `react-dom` was pinned
> (another dependent of the same advisories). The underlying advisories are identical.

## Why the number is so large

`npm audit` lists every package that _depends on_ a vulnerable package, not only the vulnerable
package itself. The 3 real advisories below propagate up through Metro, Expo CLI, Jest, ESLint and
React Native's CLI tooling, producing 79 secondary "via" entries (e.g. `expo`, `react-native`,
`jest-expo`, `eslint-config-expo` are flagged only because they depend on Metro/Jest/glob).

## Root advisories

| Package     | Advisory                                                                 | Severity        | Issue                                                                                | Installed            | Fixed in                        |
| ----------- | ------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------ | -------------------- | ------------------------------- |
| `picomatch` | [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | High (CVSS 7.5) | ReDoS: slow regex on crafted extglob **patterns** (CWE-1333)                         | 2.3.2, 4.0.7         | **No fixed release exists yet** |
| `minimatch` | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | Moderate        | DoS via glob-pattern amplification (CWE-405)                                         | 3.1.5, 9.0.9, 10.2.6 | 11.0.1+ (major upgrade only)    |
| `glob`      | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Moderate        | `AbortSignal` cancellation not honoured; traversal continues after timeout (CWE-400) | 10.5.0, 13.0.7       | 14.0.2+ (major upgrade only)    |

Who pulls them in: Metro bundler, Expo CLI (`@expo/cli`, `@expo/fingerprint`), Jest (`jest-*`,
`test-exclude`, `babel-plugin-istanbul`), ESLint (`@typescript-eslint/*`), and React Native's CLI
plugin. All run on the developer's PC or CI, not on the phone.

## Exposure assessment

- **Not in the shipped app.** The Android and iOS production bundles were built with source maps
  (`npx expo export --source-maps`) and inspected: 38 packages / ~1,120 modules, and none of
  `picomatch`, `minimatch`, `glob`, `metro`, `jest`, `micromatch`, `anymatch`, `tinyglobby`, or `fdir`
  are present. The only `@expo/cli` file in the bundle is Metro's module loader (`metro-require`),
  which is unrelated to these advisories.
- **Build-time trigger requires attacker-controlled glob patterns.** All three issues need an
  attacker to supply the glob _pattern_ (or rely on cancellation). Here patterns come from our own
  config files (Metro, Jest, ESLint, Expo). Someone able to edit those files can already run code
  through them, so these advisories add no meaningful risk.
- **Worst realistic impact:** a slow or hung local build or CI job. No data exposure, and no health
  data is involved (the app uses simulated data only).

**Risk rating for this project: Low.**

## Why not `npm audit fix --force`

`npm audit fix --force` proposes **downgrading** to `expo@52`, `react-native@0.83`, `jest@29`,
`eslint-config-expo@55`, and `@types/jest@28`. That would break SDK 58 alignment, React 19.3, and the
test setup. Several suggested "fixes" are also still inside the advisory ranges (picomatch has no fixed
version at all), so it would not even clear the warnings.

`overrides` forcing `glob@14` / `minimatch@11` were also rejected: they are major-version jumps
underneath Expo CLI, Jest, and ESLint, with changed APIs and no upstream testing. That is a real
breakage risk to remove a low-severity finding.

## Follow-up policy

1. Re-run `npm audit` whenever Expo SDK patch releases are adopted (`npx expo install --check`), and
   at least monthly.
2. Adopt upstream fixes when Expo / React Native / Jest ship them (in particular a fixed
   `picomatch` release).
3. Escalate immediately if an advisory appears that is **critical**, affects a package that
   **ships in the app bundle**, or touches networking, auth, storage, or health data.
4. CI (#13) runs `npm audit` as a visible, non-blocking report; it blocks only on critical findings.

## How to reproduce

```powershell
cd apps\mobile
npm ci
npm audit
npm audit --json > audit.json   # full detail
npx expo export --platform android --platform ios --source-maps --output-dir %TEMP%\rivals-export
```

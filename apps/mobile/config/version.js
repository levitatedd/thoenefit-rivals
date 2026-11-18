// Version and build-number policy for the mobile app. Plain CommonJS with no dependencies so it
// can be used by app.config.js (Expo), by Jest, and by the release tooling in .github/scripts.
//
// - The app version (SemVer x.y.z) has ONE source: apps/mobile/package.json "version".
// - Build numbers (iOS buildNumber / Android versionCode) are NOT committed: they come from the
//   APP_BUILD_NUMBER environment variable (CI run number, or EAS remote versioning later).
// - The variant (development / staging / production) labels a build; it never changes the version.

'use strict';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Google Play's maximum versionCode. */
const MAX_BUILD_NUMBER = 2100000000;

const VARIANTS = Object.freeze(['development', 'staging', 'production']);
const BUMPS = Object.freeze(['none', 'patch', 'minor', 'major']);

/**
 * Parses a plain x.y.z version. Pre-release/build suffixes are rejected on purpose: the iOS
 * marketing version (CFBundleShortVersionString) only allows numbers, so test builds are told
 * apart by build number and variant instead.
 */
function parseVersion(version) {
  const match = SEMVER.exec(String(version ?? ''));
  if (!match) {
    throw new Error(`Invalid app version "${version}": expected MAJOR.MINOR.PATCH, e.g. 0.1.0`);
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

/** Negative if a < b, 0 if equal, positive if a > b. */
function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch;
}

/** Applies a bump ('none' | 'patch' | 'minor' | 'major'). */
function bumpVersion(version, bump) {
  if (!BUMPS.includes(bump)) throw new Error(`Unknown version bump "${bump}"`);
  const v = parseVersion(version);
  switch (bump) {
    case 'major':
      return formatVersion({ major: v.major + 1, minor: 0, patch: 0 });
    case 'minor':
      return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 });
    case 'patch':
      return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1 });
    default:
      return formatVersion(v);
  }
}

/**
 * Release bump implied by the changes in a release (pre-1.0 and post-1.0 alike for now):
 * any New → minor; otherwise any Improved/Fixed → patch; chores only → none.
 * A major (1.0.0 or breaking) release is always an explicit owner decision, never automatic.
 */
function suggestBump(counts) {
  if ((counts.new ?? 0) > 0) return 'minor';
  if ((counts.improved ?? 0) > 0 || (counts.fixed ?? 0) > 0) return 'patch';
  return 'none';
}

/** iOS buildNumber / Android versionCode from APP_BUILD_NUMBER (default 1 for local builds). */
function resolveBuildNumber(env = process.env) {
  const raw = env.APP_BUILD_NUMBER;
  if (raw === undefined || raw === '') return 1;
  if (!/^\d+$/.test(String(raw))) {
    throw new Error(`APP_BUILD_NUMBER must be a positive integer, got "${raw}"`);
  }
  const value = Number(raw);
  if (value < 1 || value > MAX_BUILD_NUMBER) {
    throw new Error(`APP_BUILD_NUMBER must be between 1 and ${MAX_BUILD_NUMBER}, got ${raw}`);
  }
  return value;
}

/** Build variant from APP_VARIANT (default "development"). */
function resolveVariant(env = process.env) {
  const raw = env.APP_VARIANT;
  if (raw === undefined || raw === '') return 'development';
  if (!VARIANTS.includes(raw)) {
    throw new Error(`APP_VARIANT must be one of ${VARIANTS.join(', ')}, got "${raw}"`);
  }
  return raw;
}

module.exports = {
  MAX_BUILD_NUMBER,
  VARIANTS,
  BUMPS,
  parseVersion,
  formatVersion,
  compareVersions,
  bumpVersion,
  suggestBump,
  resolveBuildNumber,
  resolveVariant,
};

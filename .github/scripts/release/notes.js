// Pure release-notes logic: categorise merged PRs, decide which belong to a release, and render
// user-facing notes. No network or git access here (see cli.js), so everything is unit-tested.

'use strict';

const { parseLinkedIssues } = require('../project-status/rules');
const { suggestBump } = require('../../../apps/mobile/config/version');

/** Branch prefix → category. Branches are created from `staging`; PRs target `staging`. */
const BRANCH_CATEGORIES = Object.freeze({
  feature: 'new',
  improve: 'improved',
  fix: 'fixed',
  chore: 'chore',
});

/** Labels that override the branch-derived category (e.g. for a mis-named branch). */
const LABEL_CATEGORIES = Object.freeze({
  'category: new': 'new',
  'category: improved': 'improved',
  'category: fixed': 'fixed',
  'category: chore': 'chore',
});

/** Order and headings of the user-facing sections. Chores are never shown to users. */
const SECTIONS = Object.freeze([
  { key: 'new', heading: 'New' },
  { key: 'improved', heading: 'Improved' },
  { key: 'fixed', heading: 'Fixed' },
]);

/** 'new' | 'improved' | 'fixed' | 'chore' | 'uncategorized' */
function categorize({ headRef, labels = [] }) {
  const names = labels.map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
  const fromLabels = [...new Set(names.map((n) => LABEL_CATEGORIES[n]).filter(Boolean))];
  if (fromLabels.length === 1) return fromLabels[0];
  if (fromLabels.length > 1) return 'uncategorized'; // conflicting labels: make a human decide
  const prefix = String(headRef ?? '').split('/')[0];
  return BRANCH_CATEGORIES[prefix] ?? 'uncategorized';
}

/** Removes trailing "(#12)" references; links are added consistently by the renderer. */
function cleanTitle(title) {
  return String(title ?? '')
    .replace(/(\s*\(#\d+(?:,\s*#\d+)*\))+\s*$/, '')
    .trim();
}

/** PR numbers already recorded in CHANGELOG.md via `<!-- released-prs: 1, 2 -->` markers. */
function releasedPrNumbers(changelog) {
  const numbers = new Set();
  for (const match of String(changelog ?? '').matchAll(/<!--\s*released-prs:([^>]*)-->/g)) {
    for (const n of match[1].match(/\d+/g) ?? []) numbers.add(Number(n));
  }
  return numbers;
}

/**
 * Selects and categorises the PRs that make up a release.
 *
 * @param {object} input
 * @param {object[]} input.prs Merged PRs: { number, title, body, headRef, baseRef, labels, mergedAt, mergeCommitSha }
 * @param {Set<string>} input.candidateShas Commits on the release head but not on the previous release (git rev-list base..head)
 * @param {Set<number>} input.alreadyReleased PR numbers recorded in CHANGELOG.md
 * @param {string} input.repo "owner/name", for parsing issue links
 * @param {string} [input.integrationBranch] Only PRs merged into this branch count (default "staging")
 */
function selectRelease({ prs, candidateShas, alreadyReleased = new Set(), repo, integrationBranch = 'staging' }) {
  const seen = new Set();
  const entries = [];
  const warnings = [];

  for (const pr of prs) {
    if (!pr.mergedAt || !pr.mergeCommitSha) continue; // closed without merging
    if (pr.baseRef !== integrationBranch) continue; // promotions and stray PRs are not changes
    if (!candidateShas.has(pr.mergeCommitSha)) continue; // not on head, or already released
    if (seen.has(pr.number)) continue; // de-duplicate repeated API pages
    seen.add(pr.number);
    if (alreadyReleased.has(pr.number)) {
      warnings.push(
        `PR #${pr.number} is already listed in CHANGELOG.md but its merge commit is not on the previous release. ` +
          'Was the last promotion squash-merged? Skipping it to avoid double counting.',
      );
      continue;
    }
    const category = categorize(pr);
    if (category === 'uncategorized') {
      warnings.push(
        `PR #${pr.number} ("${pr.title}") has no category: branch "${pr.headRef}" has no known prefix ` +
          'and no single `category: …` label. It is listed under "Other changes" until fixed.',
      );
    }
    const issues = parseLinkedIssues(`${pr.title}\n\n${pr.body ?? ''}`, repo)
      .map((i) => i.number)
      .filter((n) => n !== pr.number);
    entries.push({ number: pr.number, title: cleanTitle(pr.title), category, issues, mergedAt: pr.mergedAt });
  }

  entries.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt) || a.number - b.number);

  const counts = { new: 0, improved: 0, fixed: 0, chore: 0, uncategorized: 0 };
  for (const e of entries) counts[e.category] += 1;
  return { entries, counts, bump: suggestBump(counts), warnings };
}

function formatEntry(entry) {
  const refs = [...entry.issues.map((n) => `#${n}`), `PR #${entry.number}`].join(', ');
  return `- ${entry.title} (${refs})`;
}

/**
 * Renders the user-facing notes for one release. Chores are omitted from the visible text but
 * every released PR (chores included) is recorded in a hidden marker for traceability and
 * de-duplication.
 */
function renderRelease({ version, date, entries }) {
  const lines = [`## ${version} — ${date}`, ''];
  let visible = 0;
  for (const { key, heading } of SECTIONS) {
    const items = entries.filter((e) => e.category === key);
    if (items.length === 0) continue;
    lines.push(`### ${heading}`, '', ...items.map(formatEntry), '');
    visible += items.length;
  }
  const other = entries.filter((e) => e.category === 'uncategorized');
  if (other.length > 0) {
    lines.push('### Other changes', '', ...other.map(formatEntry), '');
    visible += other.length;
  }
  if (visible === 0) lines.push('_Maintenance only: no user-facing changes._', '');
  const all = entries.map((e) => e.number).sort((a, b) => a - b);
  lines.push(`<!-- released-prs: ${all.join(', ')} -->`, '');
  return lines.join('\n');
}

const CHANGELOG_HEADER = '# Changelog';

/** Inserts a release entry at the top of CHANGELOG.md (newest first). Refuses duplicate versions. */
function prependToChangelog(changelog, entry, version) {
  const text = String(changelog ?? '').trim()
    ? String(changelog)
    : `${CHANGELOG_HEADER}\n\nUser-facing changes to ThoeneFit Rivals.\n`;
  if (new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm').test(text)) {
    throw new Error(`CHANGELOG.md already has an entry for ${version}`);
  }
  const firstRelease = text.search(/^## /m);
  if (firstRelease === -1) return `${text.trimEnd()}\n\n${entry}`;
  return `${text.slice(0, firstRelease)}${entry}\n${text.slice(firstRelease)}`;
}

/**
 * Checks a staging → main promotion: if the release has user-facing changes, the version must
 * have been bumped by at least the suggested amount and CHANGELOG.md must contain that version.
 */
function checkReleaseReadiness({ bump, baseVersion, headVersion, changelog, compareVersions, bumpVersion }) {
  const problems = [];
  if (compareVersions(headVersion, baseVersion) < 0) {
    problems.push(`Version went backwards: ${baseVersion} → ${headVersion}.`);
    return { ok: false, problems, expected: baseVersion };
  }
  if (bump === 'none') {
    return { ok: true, problems, expected: baseVersion };
  }
  const expected = bumpVersion(baseVersion, bump);
  if (compareVersions(headVersion, expected) < 0) {
    problems.push(
      `Version is ${headVersion} but this release contains ${bump}-level changes since ${baseVersion}; ` +
        `expected at least ${expected}. Run the release preparation step (docs/DEVELOPMENT.md → "Releases").`,
    );
  }
  if (!new RegExp(`^## ${headVersion.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) {
    problems.push(`CHANGELOG.md has no "## ${headVersion}" entry.`);
  }
  return { ok: problems.length === 0, problems, expected };
}

module.exports = {
  BRANCH_CATEGORIES,
  LABEL_CATEGORIES,
  SECTIONS,
  categorize,
  cleanTitle,
  releasedPrNumbers,
  selectRelease,
  renderRelease,
  prependToChangelog,
  checkReleaseReadiness,
};

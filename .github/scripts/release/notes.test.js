'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  categorize,
  cleanTitle,
  releasedPrNumbers,
  selectRelease,
  renderRelease,
  prependToChangelog,
  checkReleaseReadiness,
} = require('./notes');
const { compareVersions, bumpVersion } = require('../../../apps/mobile/config/version');

const REPO = 'levitatedd/thoenefit-rivals';

let seq = 0;
function pr(overrides = {}) {
  seq += 1;
  return {
    number: seq,
    title: `PR ${seq}`,
    body: '',
    headRef: `chore/${seq}-x`,
    baseRef: 'staging',
    labels: [],
    mergedAt: `2026-11-18T10:${String(seq).padStart(2, '0')}:00Z`,
    mergeCommitSha: `sha${seq}`,
    ...overrides,
  };
}

test('categorize: branch prefixes', () => {
  assert.equal(categorize({ headRef: 'feature/2-scoring' }), 'new');
  assert.equal(categorize({ headRef: 'improve/3-leaderboard' }), 'improved');
  assert.equal(categorize({ headRef: 'fix/30-crash' }), 'fixed');
  assert.equal(categorize({ headRef: 'chore/22-versioning' }), 'chore');
  assert.equal(categorize({ headRef: 'claude/random' }), 'uncategorized');
  assert.equal(categorize({ headRef: 'staging' }), 'uncategorized');
  assert.equal(categorize({ headRef: undefined }), 'uncategorized');
});

test('categorize: a single category label overrides the branch; conflicting labels need a human', () => {
  assert.equal(categorize({ headRef: 'feature/13-ci', labels: [{ name: 'category: chore' }] }), 'chore');
  assert.equal(categorize({ headRef: 'chore/1', labels: ['Category: Fixed', 'bug'] }), 'fixed');
  assert.equal(
    categorize({ headRef: 'feature/1', labels: ['category: new', 'category: chore'] }),
    'uncategorized',
  );
});

test('cleanTitle strips trailing PR/issue references', () => {
  assert.equal(cleanTitle('Add scoring engine (#2)'), 'Add scoring engine');
  assert.equal(cleanTitle('Add scoring (#2, #14) (#30)'), 'Add scoring');
  assert.equal(cleanTitle('Fix #4 crash on launch'), 'Fix #4 crash on launch');
});

test('releasedPrNumbers reads every marker', () => {
  const text = '## 0.2.0\n<!-- released-prs: 30, 31 -->\n## 0.1.0\n<!-- released-prs: 16,18, 20 -->';
  assert.deepEqual([...releasedPrNumbers(text)].sort((a, b) => a - b), [16, 18, 20, 30, 31]);
  assert.equal(releasedPrNumbers('').size, 0);
});

test('selectRelease: groups by category, keeps chores out of the visible count, suggests a bump', () => {
  const prs = [
    pr({ number: 30, headRef: 'feature/2-scoring', title: 'Add Step Battle scoring (#2)', body: 'Closes #2' }),
    pr({ number: 31, headRef: 'fix/40-sync', title: 'Fix duplicate steps after sync', body: 'Fixes #40' }),
    pr({ number: 32, headRef: 'chore/22-versioning', title: 'Set up versioning', body: 'Closes #22' }),
  ];
  const result = selectRelease({ prs, candidateShas: new Set(prs.map((p) => p.mergeCommitSha)), repo: REPO });
  assert.deepEqual(result.counts, { new: 1, improved: 0, fixed: 1, chore: 1, uncategorized: 0 });
  assert.equal(result.bump, 'minor');
  assert.deepEqual(result.entries.map((e) => e.number), [30, 31, 32]);
  assert.deepEqual(result.entries[0].issues, [2]);
  assert.equal(result.entries[0].title, 'Add Step Battle scoring');
  assert.deepEqual(result.warnings, []);
});

test('selectRelease: release boundaries — unreleased head only, merged only, into staging only', () => {
  const released = pr({ number: 10, headRef: 'feature/1-a' }); // already on main
  const notMerged = pr({ number: 11, headRef: 'feature/1-b', mergedAt: null, mergeCommitSha: null });
  const promotion = pr({ number: 12, headRef: 'staging', baseRef: 'main' });
  const futureWork = pr({ number: 13, headRef: 'feature/1-c' }); // merged after the release head
  const inRelease = pr({ number: 14, headRef: 'improve/1-d' });
  const result = selectRelease({
    prs: [released, notMerged, promotion, futureWork, inRelease],
    candidateShas: new Set([inRelease.mergeCommitSha, promotion.mergeCommitSha]),
    repo: REPO,
  });
  assert.deepEqual(result.entries.map((e) => e.number), [14]);
  assert.equal(result.bump, 'patch');
});

test('selectRelease: never double-counts (duplicate API rows, or PRs already in CHANGELOG.md)', () => {
  const a = pr({ number: 20, headRef: 'feature/5-a' });
  const b = pr({ number: 21, headRef: 'fix/6-b' });
  const result = selectRelease({
    prs: [a, a, b],
    candidateShas: new Set([a.mergeCommitSha, b.mergeCommitSha]),
    alreadyReleased: new Set([21]),
    repo: REPO,
  });
  assert.deepEqual(result.entries.map((e) => e.number), [20]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /#21 .*squash/);
});

test('selectRelease: orders by merge time, then PR number', () => {
  const late = pr({ number: 40, headRef: 'feature/a', mergedAt: '2026-11-19T09:00:00Z' });
  const earlyB = pr({ number: 42, headRef: 'feature/b', mergedAt: '2026-11-18T09:00:00Z' });
  const earlyA = pr({ number: 41, headRef: 'feature/c', mergedAt: '2026-11-18T09:00:00Z' });
  const result = selectRelease({
    prs: [late, earlyB, earlyA],
    candidateShas: new Set([late, earlyB, earlyA].map((p) => p.mergeCommitSha)),
    repo: REPO,
  });
  assert.deepEqual(result.entries.map((e) => e.number), [41, 42, 40]);
});

test('selectRelease: uncategorized PRs are flagged, not silently dropped', () => {
  const odd = pr({ number: 50, headRef: 'claude/something', title: 'Mystery change' });
  const result = selectRelease({ prs: [odd], candidateShas: new Set([odd.mergeCommitSha]), repo: REPO });
  assert.equal(result.counts.uncategorized, 1);
  assert.match(result.warnings[0], /#50 .*no category/);
});

test('renderRelease: New / Improved / Fixed order, chores hidden but recorded', () => {
  const entries = [
    { number: 31, title: 'Fix duplicate steps', category: 'fixed', issues: [40], mergedAt: 'b' },
    { number: 30, title: 'Add Step Battle scoring', category: 'new', issues: [2], mergedAt: 'a' },
    { number: 33, title: 'Smoother leaderboard', category: 'improved', issues: [], mergedAt: 'c' },
    { number: 32, title: 'Set up versioning', category: 'chore', issues: [22], mergedAt: 'd' },
  ];
  const text = renderRelease({ version: '0.2.0', date: '2026-11-20', entries });
  assert.equal(
    text,
    [
      '## 0.2.0 — 2026-11-20',
      '',
      '### New',
      '',
      '- Add Step Battle scoring (#2, PR #30)',
      '',
      '### Improved',
      '',
      '- Smoother leaderboard (PR #33)',
      '',
      '### Fixed',
      '',
      '- Fix duplicate steps (#40, PR #31)',
      '',
      '<!-- released-prs: 30, 31, 32, 33 -->',
      '',
    ].join('\n'),
  );
  assert.doesNotMatch(text, /versioning/);
});

test('renderRelease: chore-only release says so', () => {
  const text = renderRelease({
    version: '0.1.1',
    date: '2026-11-20',
    entries: [{ number: 32, title: 'CI tweak', category: 'chore', issues: [], mergedAt: 'a' }],
  });
  assert.match(text, /Maintenance only/);
  assert.match(text, /released-prs: 32/);
});

test('prependToChangelog: newest first, creates a file if missing, refuses duplicates', () => {
  const existing = '# Changelog\n\nIntro.\n\n## 0.1.0 — 2026-11-18\n\n- first\n';
  const updated = prependToChangelog(existing, '## 0.2.0 — 2026-11-20\n\n- second\n', '0.2.0');
  assert.ok(updated.indexOf('## 0.2.0') < updated.indexOf('## 0.1.0'));
  assert.ok(updated.startsWith('# Changelog\n\nIntro.\n\n## 0.2.0'));
  assert.throws(() => prependToChangelog(updated, '## 0.2.0 — x\n', '0.2.0'), /already has an entry/);
  assert.match(prependToChangelog('', '## 0.1.0 — x\n', '0.1.0'), /^# Changelog[\s\S]*## 0\.1\.0/);
});

test('checkReleaseReadiness: enforces the version policy on promotions', () => {
  const deps = { compareVersions, bumpVersion };
  const changelog = '## 0.2.0 — 2026-11-20\n';
  assert.equal(
    checkReleaseReadiness({ bump: 'minor', baseVersion: '0.1.0', headVersion: '0.2.0', changelog, ...deps }).ok,
    true,
  );
  const notBumped = checkReleaseReadiness({ bump: 'minor', baseVersion: '0.1.0', headVersion: '0.1.0', changelog, ...deps });
  assert.equal(notBumped.ok, false);
  assert.match(notBumped.problems[0], /expected at least 0\.2\.0/);
  const tooSmall = checkReleaseReadiness({ bump: 'minor', baseVersion: '0.1.0', headVersion: '0.1.1', changelog: '## 0.1.1\n', ...deps });
  assert.equal(tooSmall.ok, false);
  const noEntry = checkReleaseReadiness({ bump: 'patch', baseVersion: '0.1.0', headVersion: '0.1.1', changelog: '', ...deps });
  assert.match(noEntry.problems[0], /no "## 0\.1\.1" entry/);
  assert.equal(checkReleaseReadiness({ bump: 'none', baseVersion: '0.1.0', headVersion: '0.1.0', changelog: '', ...deps }).ok, true);
  assert.match(
    checkReleaseReadiness({ bump: 'none', baseVersion: '0.2.0', headVersion: '0.1.0', changelog: '', ...deps }).problems[0],
    /backwards/,
  );
});

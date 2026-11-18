'use strict';

// End-to-end: real git history in a temporary repository, PR metadata from a JSON file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { main } = require('./cli');

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};
delete ENV.GITHUB_STEP_SUMMARY;
delete ENV.GITHUB_ACTIONS;

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-cli-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, env: ENV, encoding: 'utf8' }).trim();
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  };
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', 'https://github.com/levitatedd/thoenefit-rivals.git');
  write('apps/mobile/package.json', JSON.stringify({ name: 'm', version: '0.1.0', private: true }, null, 2) + '\n');
  write('CHANGELOG.md', '# Changelog\n\n## 0.1.0 — 2026-11-18\n\n### New\n\n- First (PR #1)\n\n<!-- released-prs: 1 -->\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'release 0.1.0');
  git('checkout', '-q', '-b', 'staging');

  /** Simulates a PR branch merged into staging with a merge commit; returns the merge sha. */
  const mergePr = (number, branch) => {
    git('checkout', '-q', '-b', branch, 'staging');
    write(`change-${number}.txt`, String(number));
    git('add', '-A');
    git('commit', '-q', '-m', `work for #${number}`);
    git('checkout', '-q', 'staging');
    git('merge', '-q', '--no-ff', branch, '-m', `Merge PR #${number}`);
    return git('rev-parse', 'HEAD');
  };
  return { dir, git, write, mergePr };
}

function prJson(dir, prs) {
  const file = path.join(dir, 'prs.json');
  fs.writeFileSync(file, JSON.stringify(prs));
  return file;
}

function pr(number, headRef, sha, extra = {}) {
  return {
    number,
    title: `Change ${number}`,
    body: '',
    headRef,
    baseRef: 'staging',
    labels: [],
    mergedAt: `2026-11-18T10:${String(number).padStart(2, '0')}:00Z`,
    mergeCommitSha: sha,
    ...extra,
  };
}

async function run(dir, args) {
  const lines = [];
  const original = console.log;
  console.log = (...parts) => lines.push(parts.join(' '));
  try {
    const code = await main(args, dir);
    return { code, out: lines.join('\n') };
  } finally {
    console.log = original;
  }
}

test('notes: only PRs on staging and not yet on main; promotion via merge commit sets the boundary', async () => {
  const { dir, git, mergePr } = makeRepo();
  const sha2 = mergePr(2, 'feature/2-scoring');
  const sha3 = mergePr(3, 'chore/3-ci');
  // Promote staging → main with a merge commit (the documented strategy).
  git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', 'staging', '-m', 'Release');
  git('checkout', '-q', 'staging');
  const sha4 = mergePr(4, 'fix/4-sync');
  const prs = prJson(dir, [pr(2, 'feature/2-scoring', sha2), pr(3, 'chore/3-ci', sha3), pr(4, 'fix/4-sync', sha4)]);

  const { code, out } = await run(dir, ['notes', '--base', 'main', '--head', 'staging', '--prs-json', prs, '--date', '2026-11-20']);
  assert.equal(code, 0);
  assert.match(out, /suggested bump: \*\*patch\*\* → 0\.1\.1/);
  assert.match(out, /### Fixed\n\n- Change 4 \(PR #4\)/);
  assert.doesNotMatch(out, /Change 2|Change 3/);
});

test('notes: a squash-merged promotion cannot cause double counting (CHANGELOG markers)', async () => {
  const { dir, git, write, mergePr } = makeRepo();
  const sha2 = mergePr(2, 'feature/2-scoring');
  // Release preparation records PR #2 in CHANGELOG.md on staging...
  write('CHANGELOG.md', '# Changelog\n\n## 0.2.0 — 2026-11-19\n\n- Change 2 (PR #2)\n\n<!-- released-prs: 2 -->\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'chore: release 0.2.0');
  // ...then the wrong strategy squashes staging into main, so staging's merge commits never reach main.
  git('checkout', '-q', 'main');
  git('merge', '-q', '--squash', 'staging');
  git('commit', '-q', '-m', 'Release (squashed)');
  git('checkout', '-q', 'staging');
  const sha5 = mergePr(5, 'improve/5-ui');
  const prs = prJson(dir, [pr(2, 'feature/2-scoring', sha2), pr(5, 'improve/5-ui', sha5)]);

  const { out } = await run(dir, ['notes', '--base', 'main', '--head', 'staging', '--prs-json', prs]);
  assert.match(out, /- Change 5 \(PR #5\)/);
  assert.doesNotMatch(out, /- Change 2/);
  assert.match(out, /PR #2 is already listed in CHANGELOG\.md/);
});

test('prepare then check: bumps the version once, writes the changelog, and the promotion check passes', async () => {
  const { dir, git, mergePr } = makeRepo();
  const sha2 = mergePr(2, 'feature/2-scoring');
  const sha3 = mergePr(3, 'chore/3-ci');
  const prs = prJson(dir, [pr(2, 'feature/2-scoring', sha2, { body: 'Closes #10' }), pr(3, 'chore/3-ci', sha3)]);

  // Before preparation, the promotion check fails: a New change needs 0.2.0.
  const before = await run(dir, ['check', '--base', 'main', '--head', 'staging', '--prs-json', prs]);
  assert.equal(before.code, 1);
  assert.match(before.out, /expected at least 0\.2\.0/);

  const prep = await run(dir, ['prepare', '--base', 'main', '--head', 'staging', '--prs-json', prs, '--date', '2026-11-20']);
  assert.equal(prep.code, 0);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'apps/mobile/package.json'), 'utf8'));
  assert.equal(pkg.version, '0.2.0');
  const changelog = fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8');
  assert.match(changelog, /## 0\.2\.0 — 2026-11-20\n\n### New\n\n- Change 2 \(#10, PR #2\)/);
  assert.match(changelog, /released-prs: 2, 3/);
  assert.ok(changelog.indexOf('## 0.2.0') < changelog.indexOf('## 0.1.0'));

  git('add', '-A');
  git('commit', '-q', '-m', 'chore: release 0.2.0');
  const after = await run(dir, ['check', '--base', 'main', '--head', 'staging', '--prs-json', prs]);
  assert.equal(after.code, 0, after.out);
  assert.match(after.out, /changes need "minor"/); // still sees the release's own PRs
  assert.doesNotMatch(after.out, /already listed/);

  // Preparing twice is refused rather than bumping again.
  await assert.rejects(
    main(['prepare', '--base', 'main', '--head', 'staging', '--prs-json', prs], dir),
    /already 0\.2\.0/,
  );
});

test('prepare: chore-only releases need no version bump', async () => {
  const { dir, mergePr } = makeRepo();
  const sha3 = mergePr(3, 'chore/3-ci');
  const prs = prJson(dir, [pr(3, 'chore/3-ci', sha3)]);
  const { code, out } = await run(dir, ['prepare', '--base', 'main', '--head', 'staging', '--prs-json', prs]);
  assert.equal(code, 0);
  assert.match(out, /no version bump/);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'apps/mobile/package.json'), 'utf8'));
  assert.equal(pkg.version, '0.1.0');
});

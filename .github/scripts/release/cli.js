#!/usr/bin/env node
// Release notes / changelog / version tooling. See docs/DEVELOPMENT.md → "Releases".
//
//   node .github/scripts/release/cli.js notes   [--base origin/main] [--head origin/staging]
//   node .github/scripts/release/cli.js check   [--base origin/main] [--head HEAD]
//   node .github/scripts/release/cli.js prepare [--base origin/main] [--head HEAD] [--date YYYY-MM-DD]
//
// Merged-PR metadata comes from the GitHub API (GITHUB_TOKEN, GITHUB_REPOSITORY), or from a
// JSON file via --prs-json (offline runs and tests). The release is every PR merged into
// `staging` whose merge commit is in `git rev-list <base>..<head>`.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const notes = require('./notes');
const version = require('../../../apps/mobile/config/version');

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].replace(/^--/, '');
    opts[key] = rest[i + 1];
    i++;
  }
  return { command, opts };
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function showFile(cwd, ref, file) {
  try {
    return git(cwd, 'show', `${ref}:${file}`);
  } catch {
    return '';
  }
}

function repoFromRemote(cwd) {
  const url = git(cwd, 'remote', 'get-url', 'origin');
  const match = /github\.com[/:]([^/]+\/[^/.]+)(\.git)?$/.exec(url);
  if (!match) throw new Error(`Cannot determine owner/repo from origin URL ${url}; set GITHUB_REPOSITORY`);
  return match[1];
}

async function fetchMergedPrs(repo, integrationBranch) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required to read pull requests (or pass --prs-json)');
  const prs = [];
  for (let page = 1; page <= 20; page++) {
    const url = `https://api.github.com/repos/${repo}/pulls?state=closed&base=${integrationBranch}&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'release-notes' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}: ${await res.text()}`);
    const batch = await res.json();
    for (const p of batch) {
      prs.push({
        number: p.number,
        title: p.title,
        body: p.body ?? '',
        headRef: p.head?.ref,
        baseRef: p.base?.ref,
        labels: (p.labels ?? []).map((l) => l.name),
        mergedAt: p.merged_at,
        mergeCommitSha: p.merge_commit_sha,
      });
    }
    if (batch.length < 100) break;
  }
  return prs;
}

async function computeRelease(cwd, opts) {
  const base = opts.base ?? 'origin/main';
  const head = opts.head ?? 'HEAD';
  const integrationBranch = opts.branch ?? 'staging';
  const repo = opts.repo ?? process.env.GITHUB_REPOSITORY ?? repoFromRemote(cwd);
  const prs = opts['prs-json']
    ? JSON.parse(fs.readFileSync(path.resolve(cwd, opts['prs-json']), 'utf8'))
    : await fetchMergedPrs(repo, integrationBranch);
  const revs = git(cwd, 'rev-list', `${base}..${head}`);
  const candidateShas = new Set(revs ? revs.split('\n') : []);
  // The head's changelog is what the release will ship; the base's changelog records what has
  // actually been released (used to guard against double counting).
  const changelog = showFile(cwd, head, 'CHANGELOG.md');
  const alreadyReleased = notes.releasedPrNumbers(showFile(cwd, base, 'CHANGELOG.md'));
  const release = notes.selectRelease({ prs, candidateShas, alreadyReleased, repo, integrationBranch });
  const baseVersion = JSON.parse(showFile(cwd, base, 'apps/mobile/package.json') || '{"version":"0.0.0"}').version;
  const headVersion = JSON.parse(showFile(cwd, head, 'apps/mobile/package.json')).version;
  return { base, head, repo, release, changelog, baseVersion, headVersion };
}

function summary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function warn(message) {
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `WARNING: ${message}`);
}

async function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const { command, opts } = parseArgs(argv);
  const today = opts.date ?? new Date().toISOString().slice(0, 10);

  if (command === 'notes') {
    const r = await computeRelease(cwd, opts);
    const nextVersion = version.bumpVersion(r.baseVersion, r.release.bump);
    const body = notes.renderRelease({ version: nextVersion, date: today, entries: r.release.entries });
    const header =
      `### Release notes preview (${r.base}..${r.head})\n\n` +
      `Released version: ${r.baseVersion} · suggested bump: **${r.release.bump}** → ${nextVersion} · ` +
      `PRs: ${r.release.entries.length} (chores hidden: ${r.release.counts.chore})\n`;
    console.log(header);
    console.log(body);
    summary(`${header}\n${body.replace(/<!--.*-->/g, '')}`);
    r.release.warnings.forEach(warn);
    return 0;
  }

  if (command === 'check') {
    const r = await computeRelease(cwd, opts);
    const result = notes.checkReleaseReadiness({
      bump: r.release.bump,
      baseVersion: r.baseVersion,
      headVersion: r.headVersion,
      changelog: r.changelog,
      compareVersions: version.compareVersions,
      bumpVersion: version.bumpVersion,
    });
    r.release.warnings.forEach(warn);
    const line = `Release check ${r.base}..${r.head}: ${r.baseVersion} → ${r.headVersion}, changes need "${r.release.bump}"`;
    console.log(line);
    summary(`### ${result.ok ? '✅' : '❌'} ${line}\n${result.problems.map((p) => `- ${p}`).join('\n')}`);
    for (const p of result.problems) console.log(process.env.GITHUB_ACTIONS ? `::error::${p}` : `ERROR: ${p}`);
    return result.ok ? 0 : 1;
  }

  if (command === 'prepare') {
    const r = await computeRelease(cwd, opts);
    r.release.warnings.forEach(warn);
    if (r.release.bump === 'none') {
      console.log('No user-facing changes since the last release: no version bump or changelog entry needed.');
      return 0;
    }
    const next = version.bumpVersion(r.baseVersion, r.release.bump);
    if (version.compareVersions(r.headVersion, next) >= 0) {
      throw new Error(`Version is already ${r.headVersion} (>= ${next}); nothing to prepare`);
    }
    const mobile = path.join(cwd, 'apps/mobile');
    execFileSync('npm', ['version', next, '--no-git-tag-version'], { cwd: mobile, stdio: 'inherit' });
    const changelogPath = path.join(cwd, 'CHANGELOG.md');
    const current = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';
    const entry = notes.renderRelease({ version: next, date: today, entries: r.release.entries });
    fs.writeFileSync(changelogPath, notes.prependToChangelog(current, entry, next));
    console.log(`Prepared ${next}: updated apps/mobile/package.json, package-lock.json and CHANGELOG.md`);
    return 0;
  }

  console.error('Usage: cli.js <notes|check|prepare> [--base REF] [--head REF] [--prs-json FILE] [--date YYYY-MM-DD]');
  return 2;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}

module.exports = { main, parseArgs };

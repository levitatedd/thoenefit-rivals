'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STATUS,
  IN_PROGRESS_LABEL,
  parseLinkedIssues,
  decideStatus,
  shouldCloseIssueOnMerge,
  shouldRemoveInProgressLabel,
} = require('./rules');

const REPO = 'levitatedd/thoenefit-rivals';

test('parseLinkedIssues: closing and reference keywords', () => {
  const body = 'Closes #15\nRefs #17 and #10\nFixes: #3, #4\nPart of #1';
  assert.deepEqual(parseLinkedIssues(body, REPO), [
    { number: 1, closes: false },
    { number: 3, closes: true },
    { number: 4, closes: true },
    { number: 10, closes: false },
    { number: 15, closes: true },
    { number: 17, closes: false },
  ]);
});

test('parseLinkedIssues: same-repo full references and URLs', () => {
  const body = `Resolves ${REPO}#9 and resolves https://github.com/${REPO}/issues/12`;
  assert.deepEqual(parseLinkedIssues(body, REPO), [
    { number: 9, closes: true },
    { number: 12, closes: true },
  ]);
});

test('parseLinkedIssues: ignores bare mentions and other repositories', () => {
  const body = 'See #20. Closes other/repo#5. Mentioned issue #21 in passing. Prefixes #22';
  assert.deepEqual(parseLinkedIssues(body, REPO), []);
});

test('parseLinkedIssues: closing keyword wins over a reference', () => {
  assert.deepEqual(parseLinkedIssues('Refs #13\n\nCloses #13', REPO), [{ number: 13, closes: true }]);
});

test('parseLinkedIssues: case-insensitive, tolerates empty input', () => {
  assert.deepEqual(parseLinkedIssues('CLOSES #2', REPO), [{ number: 2, closes: true }]);
  assert.deepEqual(parseLinkedIssues('', REPO), []);
  assert.deepEqual(parseLinkedIssues(null, REPO), []);
});

test('label: in-progress label moves Todo -> In Progress', () => {
  const event = { type: 'issue_labeled', label: IN_PROGRESS_LABEL, issueState: 'open' };
  assert.equal(decideStatus(event, STATUS.TODO).status, STATUS.IN_PROGRESS);
  assert.equal(decideStatus(event, null).status, STATUS.IN_PROGRESS);
});

test('label: other labels, closed issues and later stages are left alone', () => {
  assert.equal(decideStatus({ type: 'issue_labeled', label: 'bug', issueState: 'open' }, STATUS.TODO).status, null);
  const inProgress = { type: 'issue_labeled', label: IN_PROGRESS_LABEL, issueState: 'open' };
  assert.equal(decideStatus(inProgress, STATUS.IN_REVIEW).status, null);
  assert.equal(decideStatus(inProgress, STATUS.DONE).status, null);
  assert.equal(decideStatus(inProgress, STATUS.IN_PROGRESS).status, null);
  assert.equal(decideStatus({ ...inProgress, issueState: 'closed' }, STATUS.TODO).status, null);
});

test('reopened: back to Todo, or In Progress when labelled', () => {
  assert.equal(decideStatus({ type: 'issue_reopened', hasInProgressLabel: false }, STATUS.DONE).status, STATUS.TODO);
  assert.equal(decideStatus({ type: 'issue_reopened', hasInProgressLabel: true }, STATUS.DONE).status, STATUS.IN_PROGRESS);
});

test('closed: issue goes to Done', () => {
  assert.equal(decideStatus({ type: 'issue_closed', stateReason: 'completed' }, STATUS.IN_REVIEW).status, STATUS.DONE);
  assert.equal(decideStatus({ type: 'issue_closed' }, STATUS.DONE).status, null);
});

const checks = (overrides) => ({
  type: 'pr_checks_completed',
  prNumber: 20,
  draft: false,
  baseRef: 'staging',
  checksResult: 'success',
  ...overrides,
});

test('checks: ready PR to staging with green CI -> In Review', () => {
  assert.equal(decideStatus(checks(), STATUS.IN_PROGRESS).status, STATUS.IN_REVIEW);
  assert.equal(decideStatus(checks(), STATUS.TODO).status, STATUS.IN_REVIEW);
});

test('checks: drafts, failed CI, other bases and Done issues are not promoted', () => {
  assert.equal(decideStatus(checks({ draft: true }), STATUS.IN_PROGRESS).status, null);
  assert.equal(decideStatus(checks({ checksResult: 'failure' }), STATUS.IN_PROGRESS).status, null);
  assert.equal(decideStatus(checks({ checksResult: 'cancelled' }), STATUS.IN_PROGRESS).status, null);
  assert.equal(decideStatus(checks({ baseRef: 'main' }), STATUS.IN_PROGRESS).status, null);
  assert.equal(decideStatus(checks(), STATUS.DONE).status, null);
});

test('checks: CI failing after review started moves back to In Progress', () => {
  assert.equal(decideStatus(checks({ checksResult: 'failure' }), STATUS.IN_REVIEW).status, STATUS.IN_PROGRESS);
});

test('draft conversion: In Review -> In Progress only', () => {
  const event = { type: 'pr_converted_to_draft', prNumber: 20 };
  assert.equal(decideStatus(event, STATUS.IN_REVIEW).status, STATUS.IN_PROGRESS);
  assert.equal(decideStatus(event, STATUS.TODO).status, null);
});

const closed = (overrides) => ({
  type: 'pr_closed',
  prNumber: 20,
  merged: true,
  baseRef: 'staging',
  closes: true,
  ...overrides,
});

test('PR merged into staging with a closing keyword -> Done and close issue', () => {
  assert.equal(decideStatus(closed(), STATUS.IN_REVIEW).status, STATUS.DONE);
  assert.equal(shouldCloseIssueOnMerge(closed()), true);
});

test('PR merged with only a reference does not complete the issue', () => {
  assert.equal(decideStatus(closed({ closes: false }), STATUS.IN_REVIEW).status, null);
  assert.equal(shouldCloseIssueOnMerge(closed({ closes: false })), false);
});

test('promotion PR merged into main does not change issue status', () => {
  assert.equal(decideStatus(closed({ baseRef: 'main' }), STATUS.IN_REVIEW).status, null);
  assert.equal(shouldCloseIssueOnMerge(closed({ baseRef: 'main' })), false);
});

test('PR closed without merging is never treated as completed', () => {
  const event = closed({ merged: false });
  assert.equal(decideStatus(event, STATUS.IN_REVIEW).status, STATUS.IN_PROGRESS);
  assert.equal(decideStatus(event, STATUS.IN_PROGRESS).status, null);
  assert.equal(shouldCloseIssueOnMerge(event), false);
});

test('in-progress label is removed only when the issue becomes closed', () => {
  assert.equal(shouldRemoveInProgressLabel({ type: 'issue_closed' }), true);
  assert.equal(shouldRemoveInProgressLabel(closed()), true);
  assert.equal(shouldRemoveInProgressLabel(closed({ closes: false })), false);
  assert.equal(shouldRemoveInProgressLabel(closed({ merged: false })), false);
  assert.equal(shouldRemoveInProgressLabel({ type: 'issue_reopened' }), false);
});

// Pure decision logic for GitHub Project status automation.
// No network access here, so every rule is unit-tested (see rules.test.js).

'use strict';

const STATUS = Object.freeze({
  TODO: 'Todo',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
});

/** Label that marks "implementation has actually started" on an issue. */
const IN_PROGRESS_LABEL = 'status: in progress';

const CLOSING_KEYWORDS = ['close', 'closes', 'closed', 'fix', 'fixes', 'fixed', 'resolve', 'resolves', 'resolved'];
const REFERENCE_KEYWORDS = ['ref', 'refs', 'references', 'part of', 'related to'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds issues a PR links to via keywords in its title or body, e.g.
 * "Closes #15", "Fixes: #3, #4", "Refs owner/repo#7", "Resolves https://github.com/owner/repo/issues/9".
 *
 * GitHub only auto-links closing keywords for PRs that target the *default* branch,
 * and our PRs target `staging`, so we parse the text ourselves.
 *
 * @returns {{ number: number, closes: boolean }[]} unique issues; `closes` wins over a plain reference.
 */
function parseLinkedIssues(text, repoFullName) {
  if (!text) return [];
  const repo = escapeRegExp(repoFullName);
  const keywords = [...CLOSING_KEYWORDS, ...REFERENCE_KEYWORDS]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(' ', '\\s+'))
    .join('|');
  const ref = `(?:#|${repo}#|https://github\\.com/${repo}/issues/)(\\d+)`;
  const clause = new RegExp(`\\b(${keywords})\\s*:?\\s+(${ref}(?:\\s*(?:,|and)\\s*${ref})*)`, 'gi');
  const singleRef = new RegExp(ref, 'gi');

  const found = new Map();
  for (const match of text.matchAll(clause)) {
    const keyword = match[1].toLowerCase().replace(/\s+/g, ' ');
    const closes = CLOSING_KEYWORDS.includes(keyword);
    for (const refMatch of match[2].matchAll(singleRef)) {
      const number = Number(refMatch[1]);
      found.set(number, { number, closes: closes || (found.get(number)?.closes ?? false) });
    }
  }
  return [...found.values()].sort((a, b) => a.number - b.number);
}

/**
 * Decides which status an issue should move to for a normalized event.
 *
 * @param {object} event
 * @param {string} event.type One of:
 *   'issue_labeled' | 'issue_reopened' | 'issue_closed' |
 *   'pr_checks_completed' | 'pr_converted_to_draft' | 'pr_closed'
 * @param {string|null} currentStatus The issue's current Project status (null if unset/not on board).
 * @returns {{ status: string|null, reason: string }} status === null means "leave unchanged".
 */
function decideStatus(event, currentStatus) {
  const keep = (reason) => ({ status: null, reason });
  const move = (status, reason) =>
    status === currentStatus ? keep(`already ${status}`) : { status, reason };

  switch (event.type) {
    case 'issue_labeled':
      if (event.label !== IN_PROGRESS_LABEL) return keep(`label "${event.label}" is not a status signal`);
      if (event.issueState === 'closed') return keep('issue is closed');
      if (currentStatus === STATUS.IN_REVIEW || currentStatus === STATUS.DONE) {
        return keep(`not moving backwards from ${currentStatus}`);
      }
      return move(STATUS.IN_PROGRESS, `"${IN_PROGRESS_LABEL}" label added`);

    case 'issue_reopened':
      return event.hasInProgressLabel
        ? move(STATUS.IN_PROGRESS, 'reopened and labelled in progress')
        : move(STATUS.TODO, 'issue reopened');

    case 'issue_closed':
      return move(STATUS.DONE, `issue closed (${event.stateReason || 'completed'})`);

    case 'pr_checks_completed':
      if (event.draft) return keep('PR is a draft');
      if (event.baseRef !== 'staging') return keep(`PR targets ${event.baseRef}, not staging`);
      if (currentStatus === STATUS.DONE) return keep('issue is already Done');
      if (event.checksResult === 'success') {
        return move(STATUS.IN_REVIEW, `PR #${event.prNumber} is ready for review and CI passed`);
      }
      if (event.checksResult === 'failure' && currentStatus === STATUS.IN_REVIEW) {
        return move(STATUS.IN_PROGRESS, `CI failed on PR #${event.prNumber}`);
      }
      return keep(`CI result "${event.checksResult}" does not change status`);

    case 'pr_converted_to_draft':
      return currentStatus === STATUS.IN_REVIEW
        ? move(STATUS.IN_PROGRESS, `PR #${event.prNumber} converted to draft`)
        : keep('issue was not In Review');

    case 'pr_closed':
      if (event.merged) {
        if (event.baseRef !== 'staging') return keep(`merged into ${event.baseRef}; promotion PRs do not change issue status`);
        return event.closes
          ? move(STATUS.DONE, `PR #${event.prNumber} merged into staging`)
          : keep(`PR #${event.prNumber} only references this issue`);
      }
      return currentStatus === STATUS.IN_REVIEW
        ? move(STATUS.IN_PROGRESS, `PR #${event.prNumber} closed without merging`)
        : keep('PR closed without merging; issue was not In Review');

    default:
      return keep(`unhandled event type "${event.type}"`);
  }
}

/** Whether a merged PR should close the linked issue itself (GitHub won't, for non-default bases). */
function shouldCloseIssueOnMerge(event) {
  return event.type === 'pr_closed' && event.merged && event.baseRef === 'staging' && event.closes;
}

/** Whether the "work started" label should be removed because the issue is now closed. */
function shouldRemoveInProgressLabel(event) {
  return event.type === 'issue_closed' || shouldCloseIssueOnMerge(event);
}

module.exports = {
  STATUS,
  IN_PROGRESS_LABEL,
  parseLinkedIssues,
  decideStatus,
  shouldCloseIssueOnMerge,
  shouldRemoveInProgressLabel,
};

'use strict';

// End-to-end tests of main.js against an in-memory fake of the GitHub REST + GraphQL APIs.

const test = require('node:test');
const assert = require('node:assert/strict');

const run = require('./main');

const REPO = { owner: 'levitatedd', repo: 'thoenefit-rivals' };
const FULL = 'levitatedd/thoenefit-rivals';

function fakeEnvironment({ issues = {}, board = {}, failFirstGraphql = 0, ignoreWrites = false } = {}) {
  const state = {
    issues: structuredClone(issues), // number -> { node_id, state, labels }
    board: { ...board }, // node_id -> status (absent = not on board)
    comments: [],
    graphqlCalls: 0,
    logs: [],
    warnings: [],
    errors: [],
    failed: null,
    summary: null,
  };
  let failuresLeft = failFirstGraphql;
  const items = () => Object.keys(state.board);

  const graphql = async (query, vars) => {
    state.graphqlCalls++;
    if (failuresLeft > 0) {
      failuresLeft--;
      throw Object.assign(new Error('Bad Gateway'), { status: 502 });
    }
    if (query.includes('user(login')) {
      return {
        user: {
          projectV2: {
            id: 'P1',
            title: 'ThoeneFit: Rivals',
            field: { id: 'F1', name: 'Status', options: ['Todo', 'In Progress', 'In Review', 'Done'].map((n) => ({ id: `opt-${n}`, name: n })) },
          },
        },
      };
    }
    if (query.includes('projectItems')) {
      const onBoard = items().includes(vars.id);
      return {
        node: {
          projectItems: {
            nodes: onBoard ? [{ id: `item-${vars.id}`, project: { id: 'P1' }, fieldValueByName: state.board[vars.id] ? { name: state.board[vars.id] } : null }] : [],
          },
        },
      };
    }
    if (query.includes('addProjectV2ItemById')) {
      state.board[vars.content] = null;
      return { addProjectV2ItemById: { item: { id: `item-${vars.content}` } } };
    }
    if (query.includes('updateProjectV2ItemFieldValue')) {
      if (!ignoreWrites) state.board[vars.item.replace('item-', '')] = vars.option.replace('opt-', '');
      return { updateProjectV2ItemFieldValue: { projectV2Item: { id: vars.item } } };
    }
    throw new Error(`unexpected query: ${query}`);
  };

  const github = {
    rest: {
      issues: {
        get: async ({ issue_number }) => {
          const issue = state.issues[issue_number];
          if (!issue) throw Object.assign(new Error('Not Found'), { status: 404 });
          return { data: { number: issue_number, ...issue } };
        },
        createComment: async ({ issue_number, body }) => state.comments.push({ issue_number, body }),
        update: async ({ issue_number, state: s }) => {
          state.issues[issue_number].state = s;
        },
        removeLabel: async ({ issue_number, name }) => {
          const labels = state.issues[issue_number]?.labels ?? [];
          if (!labels.includes(name)) throw Object.assign(new Error('Label does not exist'), { status: 404 });
          state.issues[issue_number].labels = labels.filter((l) => l !== name);
        },
      },
    },
  };

  const summary = {
    addHeading() { return this; },
    addTable(rows) { state.summary = rows; return this; },
    async write() {},
  };
  const core = {
    info: (m) => state.logs.push(m),
    warning: (m) => state.warnings.push(m),
    error: (m) => state.errors.push(m),
    setFailed: (m) => { state.failed = m; },
    summary,
  };
  return { state, github, core, getOctokit: () => ({ graphql }) };
}

function prPayload(overrides = {}) {
  return {
    number: 30,
    title: 'Add CI',
    body: 'Closes #13\nRefs #17',
    draft: false,
    merged: false,
    base: { ref: 'staging' },
    head: { repo: { full_name: FULL } },
    ...overrides,
  };
}

async function runWith(env, context, extra = {}, { token = 'secret' } = {}) {
  process.env.PROJECT_NUMBER = '4';
  process.env.PROJECT_OWNER = 'levitatedd';
  if (token) process.env.PROJECT_TOKEN = token;
  else delete process.env.PROJECT_TOKEN;
  // Speed up retries in tests.
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => realSetTimeout(fn, 0);
  try {
    await run({ github: env.github, context: { repo: REPO, ...context }, core: env.core, getOctokit: env.getOctokit, ...extra });
  } finally {
    global.setTimeout = realSetTimeout;
  }
}

const ISSUES = {
  13: { node_id: 'I13', state: 'open', labels: [] },
  17: { node_id: 'I17', state: 'open', labels: [] },
};

test('green CI on a ready PR moves linked issues to In Review (and adds missing cards)', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'In Progress' } });
  await runWith(env, { eventName: 'pull_request', payload: { action: 'synchronize', pull_request: prPayload() } }, { checksResult: 'success' });
  assert.equal(env.state.board.I13, 'In Review');
  assert.equal(env.state.board.I17, 'In Review'); // was not on the board; added
  assert.equal(env.state.failed, null);
});

test('draft PRs are not promoted', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'In Progress' } });
  await runWith(env, { eventName: 'pull_request', payload: { action: 'synchronize', pull_request: prPayload({ draft: true }) } }, { checksResult: 'success' });
  assert.equal(env.state.board.I13, 'In Progress');
});

test('merge into staging closes "Closes" issues and marks them Done; "Refs" issues untouched', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'In Review', I17: 'Todo' } });
  await runWith(env, { eventName: 'pull_request', payload: { action: 'closed', pull_request: prPayload({ merged: true }) } });
  assert.equal(env.state.board.I13, 'Done');
  assert.equal(env.state.issues[13].state, 'closed');
  assert.equal(env.state.comments.length, 1);
  assert.equal(env.state.board.I17, 'Todo');
  assert.equal(env.state.issues[17].state, 'open');
});

test('PR closed without merge returns In Review issues to In Progress and closes nothing', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'In Review' } });
  await runWith(env, { eventName: 'pull_request', payload: { action: 'closed', pull_request: prPayload({ merged: false }) } });
  assert.equal(env.state.board.I13, 'In Progress');
  assert.equal(env.state.issues[13].state, 'open');
});

test('in-progress label moves an issue to In Progress', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'Todo' } });
  await runWith(env, {
    eventName: 'issues',
    payload: { action: 'labeled', label: { name: 'status: in progress' }, issue: { number: 13, node_id: 'I13', state: 'open', labels: [] } },
  });
  assert.equal(env.state.board.I13, 'In Progress');
});

test('reopened issue goes back to Todo', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'Done' } });
  await runWith(env, {
    eventName: 'issues',
    payload: { action: 'reopened', issue: { number: 13, node_id: 'I13', state: 'open', labels: [] } },
  });
  assert.equal(env.state.board.I13, 'Todo');
});

test('without PROJECT_TOKEN: warns, does not claim success, still closes merged issues', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'In Review' } });
  await runWith(env, { eventName: 'pull_request', payload: { action: 'closed', pull_request: prPayload({ merged: true }) } }, {}, { token: null });
  assert.equal(env.state.board.I13, 'In Review'); // board untouched
  assert.equal(env.state.graphqlCalls, 0);
  assert.match(env.state.warnings[0], /NOT updated/);
  assert.ok(env.state.summary.slice(1).every((row) => row[3].includes('board not updated')));
  assert.equal(env.state.issues[13].state, 'closed');
  assert.equal(env.state.failed, null);
});

test('transient API errors are retried', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'Todo' }, failFirstGraphql: 2 });
  await runWith(env, {
    eventName: 'issues',
    payload: { action: 'labeled', label: { name: 'status: in progress' }, issue: { number: 13, node_id: 'I13', state: 'open', labels: [] } },
  });
  assert.equal(env.state.board.I13, 'In Progress');
  assert.equal(env.state.failed, null);
});

test('a write that does not stick is reported as a failure, never as success', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'Todo' }, ignoreWrites: true });
  await runWith(env, {
    eventName: 'issues',
    payload: { action: 'labeled', label: { name: 'status: in progress' }, issue: { number: 13, node_id: 'I13', state: 'open', labels: [] } },
  });
  assert.match(env.state.failed, /failed/);
  assert.match(env.state.summary[1][3], /verification failed/);
});

test('links to missing issues and PR numbers are handled', async () => {
  const env = fakeEnvironment({
    issues: { 13: ISSUES[13], 16: { node_id: 'PR16', state: 'closed', labels: [], pull_request: {} } },
    board: { I13: 'In Progress' },
  });
  await runWith(env, { eventName: 'pull_request', payload: { action: 'synchronize', pull_request: prPayload({ body: 'Closes #13, #16, #999' }) } }, { checksResult: 'success' });
  assert.equal(env.state.board.I13, 'In Review');
  assert.equal(env.state.board.PR16, undefined); // PR numbers are skipped
  assert.match(env.state.failed, /failed/); // #999 could not be read
});

test('fork PRs are ignored', async () => {
  const env = fakeEnvironment({ issues: ISSUES, board: { I13: 'In Progress' } });
  await runWith(env, {
    eventName: 'pull_request',
    payload: { action: 'synchronize', pull_request: prPayload({ head: { repo: { full_name: 'someone/fork' } } }) },
  }, { checksResult: 'success' });
  assert.equal(env.state.board.I13, 'In Progress');
  assert.equal(env.state.graphqlCalls, 0);
});

test('merge into staging removes the in-progress label from closed issues only', async () => {
  const env = fakeEnvironment({
    issues: {
      13: { node_id: 'I13', state: 'open', labels: ['status: in progress'] },
      17: { node_id: 'I17', state: 'open', labels: ['status: in progress'] },
    },
    board: { I13: 'In Review', I17: 'In Progress' },
  });
  await runWith(env, { eventName: 'pull_request', payload: { action: 'closed', pull_request: prPayload({ merged: true }) } });
  assert.deepEqual(env.state.issues[13].labels, []);
  assert.deepEqual(env.state.issues[17].labels, ['status: in progress']); // "Refs" only: still open, keeps label
  assert.equal(env.state.failed, null);
});

test('closing an issue removes the in-progress label; a missing label is not an error', async () => {
  const env = fakeEnvironment({
    issues: { 13: { node_id: 'I13', state: 'closed', labels: ['status: in progress'] }, 14: { node_id: 'I14', state: 'closed', labels: [] } },
    board: { I13: 'In Review', I14: 'In Progress' },
  });
  await runWith(env, { eventName: 'issues', payload: { action: 'closed', issue: { number: 13, node_id: 'I13', state: 'closed', state_reason: 'completed', labels: [] } } });
  await runWith(env, { eventName: 'issues', payload: { action: 'closed', issue: { number: 14, node_id: 'I14', state: 'closed', state_reason: 'completed', labels: [] } } });
  assert.deepEqual(env.state.issues[13].labels, []);
  assert.equal(env.state.board.I13, 'Done');
  assert.equal(env.state.board.I14, 'Done');
  assert.equal(env.state.warnings.length, 0);
  assert.equal(env.state.failed, null);
});

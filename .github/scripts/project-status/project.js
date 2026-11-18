// GitHub Projects (v2) GraphQL helpers. Requires a token that can edit the
// user-owned project (see docs/DEVELOPMENT.md → "Project board automation").

'use strict';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function isRetryable(error) {
  if (!error) return false;
  if (RETRYABLE_STATUS.has(error.status)) return true;
  if (error.status === 403 && /rate limit|secondary/i.test(error.message || '')) return true;
  // Network-level failures have no HTTP status.
  return error.status === undefined && /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed/i.test(error.message || '');
}

async function withRetry(label, fn, { attempts = 3, baseDelayMs = 2000, log = () => {} } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryable(error)) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      log(`${label} failed (${error.status ?? 'network'}: ${error.message}); retrying in ${delay} ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const PROJECT_FIELDS = `
  id
  title
  field(name: $field) {
    ... on ProjectV2SingleSelectField { id name options { id name } }
  }
`;

/** Loads the project and its single-select status field. Works for user- or org-owned projects. */
async function loadProject(graphql, { owner, number, statusField }) {
  const variables = { owner, number, field: statusField };
  let project = null;
  try {
    const data = await graphql(
      `query($owner: String!, $number: Int!, $field: String!) { user(login: $owner) { projectV2(number: $number) { ${PROJECT_FIELDS} } } }`,
      variables,
    );
    project = data.user?.projectV2 ?? null;
  } catch (error) {
    if (!/Could not resolve to a User/i.test(error.message || '')) throw error;
  }
  if (!project) {
    const data = await graphql(
      `query($owner: String!, $number: Int!, $field: String!) { organization(login: $owner) { projectV2(number: $number) { ${PROJECT_FIELDS} } } }`,
      variables,
    );
    project = data.organization?.projectV2 ?? null;
  }
  if (!project) throw new Error(`Project ${owner}/${number} not found or not accessible with PROJECT_TOKEN`);
  if (!project.field?.options) {
    throw new Error(`Project "${project.title}" has no single-select field named "${statusField}"`);
  }
  return {
    id: project.id,
    title: project.title,
    fieldId: project.field.id,
    options: new Map(project.field.options.map((o) => [o.name, o.id])),
  };
}

/** Returns { itemId, status } for the issue's card on this project, or null if it is not on the board. */
async function getIssueItem(graphql, project, issueNodeId, statusField) {
  const data = await graphql(
    `query($id: ID!, $field: String!) {
      node(id: $id) {
        ... on Issue {
          projectItems(first: 50, includeArchived: true) {
            nodes {
              id
              project { id }
              fieldValueByName(name: $field) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
            }
          }
        }
      }
    }`,
    { id: issueNodeId, field: statusField },
  );
  const item = data.node?.projectItems?.nodes?.find((n) => n.project?.id === project.id);
  return item ? { itemId: item.id, status: item.fieldValueByName?.name ?? null } : null;
}

async function addIssueToProject(graphql, project, issueNodeId) {
  const data = await graphql(
    `mutation($project: ID!, $content: ID!) {
      addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
    }`,
    { project: project.id, content: issueNodeId },
  );
  return data.addProjectV2ItemById.item.id;
}

async function setItemStatus(graphql, project, itemId, statusName) {
  const optionId = project.options.get(statusName);
  if (!optionId) {
    throw new Error(
      `Status option "${statusName}" does not exist on project "${project.title}" (has: ${[...project.options.keys()].join(', ')})`,
    );
  }
  await graphql(
    `mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option }
      }) { projectV2Item { id } }
    }`,
    { project: project.id, item: itemId, field: project.fieldId, option: optionId },
  );
}

module.exports = { isRetryable, withRetry, loadProject, getIssueItem, addIssueToProject, setItemStatus };

import http from 'node:http';
import {
  assignTask,
  changeSubtaskStatus,
  changeTaskStatus,
  createRecurringTaskInstance,
  generateDailyBrief,
  generateWeeklyReview,
  groupTasksForKanban,
  requestOwnerDecision,
  resolveOwnerDecision,
  updateTaskDetails
} from '../../../packages/core/src/index.js';
import { FileOwnerOpsStore, InMemoryOwnerOpsStore } from '../../../packages/storage/src/index.js';
import { approveSuggestedTask, triageEmailToTaskSuggestion } from '../../../packages/triage/src/index.js';

export { FileOwnerOpsStore, InMemoryOwnerOpsStore };

export function createOwnerOpsServer(options = {}) {
  const store = options.store || createDefaultStore(options);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const body = await readJsonBody(req);
      const result = await route({ method: req.method || 'GET', url, body, store });
      sendJson(res, result.status || 200, result.body);
    } catch (error) {
      sendJson(res, error.statusCode || 500, {
        error: {
          code: error.code || 'OWNEROPS_ERROR',
          message: error.message || 'OwnerOps request failed.'
        }
      });
    }
  });
}

function createDefaultStore(options) {
  if (options.filePath || process.env.OWNEROPS_DATA_FILE) {
    return new FileOwnerOpsStore({ filePath: options.filePath || process.env.OWNEROPS_DATA_FILE });
  }
  return new InMemoryOwnerOpsStore();
}

async function route({ method, url, body, store }) {
  if (method === 'GET' && url.pathname === '/healthz') {
    return { body: { ok: true, service: 'ownerops-api' } };
  }

  if (method === 'POST' && url.pathname === '/api/workspaces') {
    return { status: 201, body: store.createWorkspace(body) };
  }

  const workspaceUserMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/users$/);
  if (method === 'POST' && workspaceUserMatch) {
    return { status: 201, body: store.addWorkspaceUser(workspaceUserMatch[1], body) };
  }

  const workspaceProjectMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/projects$/);
  if (method === 'POST' && workspaceProjectMatch) {
    return { status: 201, body: store.createProject(workspaceProjectMatch[1], body) };
  }

  const workspaceListMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/lists$/);
  if (method === 'POST' && workspaceListMatch) {
    return { status: 201, body: store.createTaskList(workspaceListMatch[1], body) };
  }

  if (method === 'POST' && url.pathname === '/api/tasks') {
    store.requireWorkspace(body.workspaceId);
    return { status: 201, body: store.createTask(body) };
  }

  if (method === 'GET' && url.pathname === '/api/tasks') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: { tasks: store.listTasks(workspaceId, queryFilters(url)) } };
  }

  const taskUpdateMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (method === 'PATCH' && taskUpdateMatch) {
    const task = store.getTask(body.workspaceId, taskUpdateMatch[1]);
    const updated = updateTaskDetails(task, body);
    return { body: store.updateTask(updated) };
  }

  const taskStatusMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
  if (method === 'PATCH' && taskStatusMatch) {
    const task = store.getTask(body.workspaceId, taskStatusMatch[1]);
    const updated = changeTaskStatus(task, body.status, body);
    return { body: store.updateTask(updated) };
  }

  const taskAssignMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/assign$/);
  if (method === 'PATCH' && taskAssignMatch) {
    const task = store.getTask(body.workspaceId, taskAssignMatch[1]);
    const updated = assignTask(task, body.ownerId, body);
    return { body: store.updateTask(updated) };
  }

  const taskCommentMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/comments$/);
  if (method === 'POST' && taskCommentMatch) {
    return {
      status: 201,
      body: store.addTaskComment(body.workspaceId, taskCommentMatch[1], body)
    };
  }

  const taskSubtaskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/subtasks$/);
  if (method === 'POST' && taskSubtaskMatch) {
    return {
      status: 201,
      body: store.addSubtask(body.workspaceId, taskSubtaskMatch[1], body)
    };
  }

  const subtaskStatusMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/subtasks\/([^/]+)\/status$/);
  if (method === 'PATCH' && subtaskStatusMatch) {
    const task = store.getTask(body.workspaceId, subtaskStatusMatch[1]);
    const updated = changeSubtaskStatus(task, subtaskStatusMatch[2], body.status, body);
    return { body: store.updateTask(updated) };
  }

  const taskArchiveMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/archive$/);
  if (method === 'POST' && taskArchiveMatch) {
    return { body: store.archiveTask(body.workspaceId, taskArchiveMatch[1], body) };
  }

  const taskReopenMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/reopen$/);
  if (method === 'POST' && taskReopenMatch) {
    return { body: store.reopenTask(body.workspaceId, taskReopenMatch[1], body) };
  }

  const recurringMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/recurring-instance$/);
  if (method === 'POST' && recurringMatch) {
    const task = store.getTask(body.workspaceId, recurringMatch[1]);
    return { status: 201, body: store.createTask(createRecurringTaskInstance(task, body)) };
  }

  const ownerDecisionMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/owner-decision$/);
  if (method === 'POST' && ownerDecisionMatch) {
    const task = store.getTask(body.workspaceId, ownerDecisionMatch[1]);
    const updated = requestOwnerDecision(task, body);
    return { body: store.updateTask(updated) };
  }

  const ownerDecisionResolveMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/owner-decision\/resolve$/);
  if (method === 'POST' && ownerDecisionResolveMatch) {
    const task = store.getTask(body.workspaceId, ownerDecisionResolveMatch[1]);
    const updated = resolveOwnerDecision(task, body);
    return { body: store.updateTask(updated) };
  }

  if (method === 'GET' && url.pathname === '/api/boards/kanban') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: groupTasksForKanban(store.listTasks(workspaceId, queryFilters(url))) };
  }

  if (method === 'POST' && url.pathname === '/api/triage/email') {
    store.requireWorkspace(body.workspaceId);
    const suggestion = triageEmailToTaskSuggestion(body.email, body);
    return { status: 201, body: store.saveSuggestion(suggestion) };
  }

  const suggestionApproveMatch = url.pathname.match(/^\/api\/triage\/suggestions\/([^/]+)\/approve$/);
  if (method === 'POST' && suggestionApproveMatch) {
    const suggestion = store.getSuggestion(body.workspaceId, suggestionApproveMatch[1]);
    const task = await approveSuggestedTask(suggestion, {
      createTask: (item) => store.createTaskFromSuggestion(item)
    }, body);
    return { status: 201, body: task };
  }

  if (method === 'GET' && url.pathname === '/api/briefs/daily') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return {
      body: generateDailyBrief(store.allTasks(workspaceId), { now: url.searchParams.get('now') || undefined })
    };
  }

  if (method === 'GET' && url.pathname === '/api/briefs/weekly') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: generateWeeklyReview(store.allTasks(workspaceId)) };
  }

  throw notFound('ROUTE_NOT_FOUND', 'Route not found.');
}

async function readJsonBody(req) {
  if (!['POST', 'PATCH', 'PUT'].includes(req.method || 'GET')) return {};
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid JSON body.');
    error.statusCode = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function requiredQuery(url, name) {
  const value = String(url.searchParams.get(name) || '').trim();
  if (!value) {
    const error = new Error(`${name} required.`);
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return value;
}

function queryFilters(url) {
  return {
    query: url.searchParams.get('query') || url.searchParams.get('q') || undefined,
    ownerId: url.searchParams.get('ownerId') || undefined,
    projectId: url.searchParams.get('projectId') || undefined,
    listId: url.searchParams.get('listId') || undefined,
    status: url.searchParams.get('status') || undefined,
    tag: url.searchParams.get('tag') || undefined,
    dueBefore: url.searchParams.get('dueBefore') || undefined,
    dueAfter: url.searchParams.get('dueAfter') || undefined,
    includeArchived: url.searchParams.get('includeArchived') === 'true'
  };
}

function notFound(code, message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = code;
  return error;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number.parseInt(process.env.OWNEROPS_PORT || '3100', 10);
  createOwnerOpsServer().listen(port, () => {
    console.log(`OwnerOps API listening on ${port}`);
  });
}

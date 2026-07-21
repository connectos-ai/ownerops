import http from 'node:http';
import {
  addWorkspaceUser,
  assignTask,
  changeTaskStatus,
  createTask,
  createWorkspace,
  generateDailyBrief,
  generateWeeklyReview,
  groupTasksForKanban,
  requestOwnerDecision,
  resolveOwnerDecision
} from '../../../packages/core/src/index.js';
import { approveSuggestedTask, triageEmailToTaskSuggestion } from '../../../packages/triage/src/index.js';

export function createOwnerOpsServer(options = {}) {
  const store = options.store || new InMemoryOwnerOpsStore();

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

export class InMemoryOwnerOpsStore {
  constructor() {
    this.workspaces = new Map();
    this.tasks = new Map();
    this.suggestions = new Map();
  }

  createWorkspace(input) {
    const workspace = createWorkspace(input);
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  addWorkspaceUser(workspaceId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    return addWorkspaceUser(workspace, input);
  }

  createTask(input) {
    const existing = this.findTaskBySource(input.workspaceId, input.sourceType, input.sourceReference);
    if (existing) return existing;
    const task = createTask(input);
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(workspaceId, taskId) {
    const task = this.tasks.get(taskId);
    if (!task || task.workspaceId !== workspaceId) throw notFound('TASK_NOT_FOUND', 'Task not found.');
    return task;
  }

  updateTask(task) {
    this.tasks.set(task.id, task);
    return task;
  }

  listTasks(workspaceId) {
    return [...this.tasks.values()].filter((task) => task.workspaceId === workspaceId);
  }

  saveSuggestion(suggestion) {
    this.suggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  getSuggestion(workspaceId, suggestionId) {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.task.workspaceId !== workspaceId) throw notFound('SUGGESTION_NOT_FOUND', 'Suggestion not found.');
    return suggestion;
  }

  async createTaskFromSuggestion(task) {
    return this.createTask(task);
  }

  async listTasksForDestination() {
    return [...this.tasks.values()];
  }

  findTaskBySource(workspaceId, sourceType, sourceReference) {
    if (!sourceReference) return null;
    return [...this.tasks.values()].find((task) => (
      task.workspaceId === workspaceId
      && task.sourceType === sourceType
      && task.sourceReference === sourceReference
    )) || null;
  }

  requireWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw notFound('WORKSPACE_NOT_FOUND', 'Workspace not found.');
    return workspace;
  }
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

  if (method === 'POST' && url.pathname === '/api/tasks') {
    store.requireWorkspace(body.workspaceId);
    return { status: 201, body: store.createTask(body) };
  }

  if (method === 'GET' && url.pathname === '/api/tasks') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: { tasks: store.listTasks(workspaceId) } };
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
    return { body: groupTasksForKanban(store.listTasks(workspaceId)) };
  }

  if (method === 'POST' && url.pathname === '/api/triage/email') {
    store.requireWorkspace(body.workspaceId);
    const suggestion = triageEmailToTaskSuggestion(body.email, body);
    return { status: 201, body: store.saveSuggestion(suggestion) };
  }

  const suggestionApproveMatch = url.pathname.match(/^\/api\/triage\/suggestions\/([^/]+)\/approve$/);
  if (method === 'POST' && suggestionApproveMatch) {
    const suggestion = store.getSuggestion(body.workspaceId, suggestionApproveMatch[1]);
    const task = await approveSuggestedTask(suggestion, { createTask: (item) => store.createTaskFromSuggestion(item) }, body);
    return { status: 201, body: task };
  }

  if (method === 'GET' && url.pathname === '/api/briefs/daily') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: generateDailyBrief(store.listTasks(workspaceId), { now: url.searchParams.get('now') || undefined }) };
  }

  if (method === 'GET' && url.pathname === '/api/briefs/weekly') {
    const workspaceId = requiredQuery(url, 'workspaceId');
    store.requireWorkspace(workspaceId);
    return { body: generateWeeklyReview(store.listTasks(workspaceId)) };
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
    const error = new Error(`${name} is required.`);
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  return value;
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

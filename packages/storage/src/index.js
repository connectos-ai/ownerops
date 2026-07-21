import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  addSubtask,
  addTaskComment,
  addWorkspaceUser,
  archiveTask,
  createProject,
  createTask,
  createTaskList,
  createWorkspace,
  reopenTask,
  searchTasks
} from '../../core/src/index.js';

const STORE_VERSION = 1;

export class InMemoryOwnerOpsStore {
  constructor(snapshot) {
    this.workspaces = new Map();
    this.tasks = new Map();
    this.suggestions = new Map();
    this.processedSlackActions = new Set();
    if (snapshot) this.loadSnapshot(snapshot);
  }

  createWorkspace(input) {
    const workspace = createWorkspace(input);
    this.workspaces.set(workspace.id, workspace);
    this.persist();
    return workspace;
  }

  addWorkspaceUser(workspaceId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    const user = addWorkspaceUser(workspace, input);
    this.persist();
    return user;
  }

  createProject(workspaceId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    const project = createProject(workspace, input);
    this.persist();
    return project;
  }

  createTaskList(workspaceId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    const list = createTaskList(workspace, input);
    this.persist();
    return list;
  }

  createTask(input) {
    const existing = this.findTaskBySource(input.workspaceId, input.sourceType, input.sourceReference);
    if (existing) return existing;
    const task = createTask(input);
    this.tasks.set(task.id, task);
    this.persist();
    return task;
  }

  createTaskFromSuggestion(task) {
    return this.createTask(task);
  }

  getTask(workspaceId, taskId) {
    const task = this.tasks.get(taskId);
    if (!task || task.workspaceId !== workspaceId) throw notFound('TASK_NOT_FOUND', 'Task not found.');
    return task;
  }

  updateTask(task) {
    this.tasks.set(task.id, task);
    this.persist();
    return task;
  }

  addTaskComment(workspaceId, taskId, input) {
    const task = this.getTask(workspaceId, taskId);
    return this.updateTask(addTaskComment(task, input));
  }

  addSubtask(workspaceId, taskId, input) {
    const task = this.getTask(workspaceId, taskId);
    return this.updateTask(addSubtask(task, input));
  }

  archiveTask(workspaceId, taskId, input) {
    const task = this.getTask(workspaceId, taskId);
    return this.updateTask(archiveTask(task, input));
  }

  reopenTask(workspaceId, taskId, input) {
    const task = this.getTask(workspaceId, taskId);
    return this.updateTask(reopenTask(task, input));
  }

  saveSuggestion(suggestion) {
    this.suggestions.set(suggestion.id, suggestion);
    this.persist();
    return suggestion;
  }

  hasProcessedSlackAction(idempotencyKey) {
    return this.processedSlackActions.has(idempotencyKey);
  }

  markProcessedSlackAction(idempotencyKey) {
    this.processedSlackActions.add(idempotencyKey);
    this.persist();
  }

  getSuggestion(workspaceId, suggestionId) {
    const suggestion = this.suggestions.get(suggestionId);
    const suggestionWorkspaceId = suggestion?.workspaceId || suggestion?.task?.workspaceId;
    if (!suggestion || suggestionWorkspaceId !== workspaceId) {
      throw notFound('SUGGESTION_NOT_FOUND', 'Suggestion not found.');
    }
    return suggestion;
  }

  listTasks(workspaceId, filters = {}) {
    return searchTasks([...this.tasks.values()], { ...filters, workspaceId });
  }

  allTasks(workspaceId) {
    return [...this.tasks.values()].filter((task) => task.workspaceId === workspaceId);
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

  snapshot() {
    return {
      version: STORE_VERSION,
      exportedAt: new Date().toISOString(),
      workspaces: [...this.workspaces.values()],
      tasks: [...this.tasks.values()],
      suggestions: [...this.suggestions.values()],
      processedSlackActions: [...this.processedSlackActions.values()]
    };
  }

  loadSnapshot(snapshot) {
    for (const workspace of snapshot.workspaces || []) this.workspaces.set(workspace.id, workspace);
    for (const task of snapshot.tasks || []) this.tasks.set(task.id, task);
    for (const suggestion of snapshot.suggestions || []) this.suggestions.set(suggestion.id, suggestion);
    for (const action of snapshot.processedSlackActions || []) this.processedSlackActions.add(action);
  }

  persist() {}
}

export class FileOwnerOpsStore extends InMemoryOwnerOpsStore {
  constructor(options = {}) {
    const filePath = options.filePath || process.env.OWNEROPS_DATA_FILE || 'data/ownerops.json';
    super(readSnapshot(filePath));
    this.filePath = filePath;
  }

  persist() {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(this.snapshot(), null, 2)}\n`, { mode: 0o600 });
    renameSync(tmpPath, this.filePath);
  }
}

function readSnapshot(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function notFound(code, message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = code;
  return error;
}

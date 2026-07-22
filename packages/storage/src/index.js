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
  deactivateWorkspaceUser,
  reopenTask,
  searchTasks,
  updateWorkspaceUser
} from '../../core/src/index.js';

export {
  OWNEROPS_RELATIONAL_MIGRATIONS,
  OWNEROPS_RELATIONAL_REQUIRED_INDEXES,
  OWNEROPS_RELATIONAL_REQUIRED_TABLES,
  OWNEROPS_RELATIONAL_SCHEMA_VERSION,
  findDisallowedPlaintextSecretColumns,
  getRelationalSchemaSql,
  validateRelationalSchema
} from './relational-schema.js';
export { RelationalOwnerOpsStore, applyOwnerOpsMigrations, withOwnerOpsTransaction } from './relational-store.js';
export { createPostgresOwnerOpsStore } from './postgres.js';

const STORE_VERSION = 1;

export class InMemoryOwnerOpsStore {
  constructor(snapshot) {
    this.workspaces = new Map();
    this.tasks = new Map();
    this.suggestions = new Map();
    this.processedSlackActions = new Set();
    this.slackInstallations = new Map();
    if (snapshot) this.loadSnapshot(snapshot);
  }

  createWorkspace(input) {
    if (input?.id && this.workspaces.has(input.id)) {
      return this.workspaces.get(input.id);
    }
    const workspace = createWorkspace(input);
    this.workspaces.set(workspace.id, workspace);
    this.persist();
    return workspace;
  }

  addWorkspaceUser(workspaceId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    const existing = workspace.users.find((user) => user.id === input?.id);
    if (existing) return existing;
    const user = addWorkspaceUser(workspace, input);
    this.persist();
    return user;
  }

  updateWorkspaceUser(workspaceId, userId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    const user = updateWorkspaceUser(workspace, userId, input);
    this.persist();
    return user;
  }

  deactivateWorkspaceUser(workspaceId, userId, input = {}) {
    const workspace = this.requireWorkspace(workspaceId);
    const user = deactivateWorkspaceUser(workspace, userId, input);
    this.persist();
    return user;
  }

  createProject(workspaceId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    const existing = workspace.projects.find((project) => project.id === input?.id);
    if (existing) return existing;
    const project = createProject(workspace, input);
    this.persist();
    return project;
  }

  createTaskList(workspaceId, input) {
    const workspace = this.requireWorkspace(workspaceId);
    const existing = workspace.lists.find((list) => list.id === input?.id);
    if (existing) return existing;
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

  saveSlackInstallation(installation) {
    this.slackInstallations.set(installation.teamId, installation);
    this.persist();
    return installation;
  }

  getSlackInstallationByTeam(slackTeamId) {
    return this.slackInstallations.get(slackTeamId) || null;
  }

  revokeSlackInstallationByTeam(slackTeamId, reason = 'revoked') {
    const installation = this.slackInstallations.get(slackTeamId);
    if (!installation) return null;
    const revoked = {
      ...installation,
      status: 'REVOKED',
      botToken: null,
      authedUserToken: null,
      revokedAt: new Date().toISOString(),
      revokedReason: reason,
      updatedAt: new Date().toISOString()
    };
    this.slackInstallations.set(slackTeamId, revoked);
    this.persist();
    return revoked;
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

  findWorkspaceBySlackTeam(slackTeamId) {
    if (!slackTeamId) return null;
    return [...this.workspaces.values()].find((workspace) => workspace.policies?.slackTeamId === slackTeamId) || null;
  }

  snapshot() {
    return {
      version: STORE_VERSION,
      exportedAt: new Date().toISOString(),
      workspaces: [...this.workspaces.values()],
      tasks: [...this.tasks.values()],
      suggestions: [...this.suggestions.values()],
      processedSlackActions: [...this.processedSlackActions.values()],
      slackInstallations: [...this.slackInstallations.values()]
    };
  }

  loadSnapshot(snapshot) {
    for (const workspace of snapshot.workspaces || []) this.workspaces.set(workspace.id, workspace);
    for (const task of snapshot.tasks || []) this.tasks.set(task.id, task);
    for (const suggestion of snapshot.suggestions || []) this.suggestions.set(suggestion.id, suggestion);
    for (const action of snapshot.processedSlackActions || []) this.processedSlackActions.add(action);
    for (const installation of snapshot.slackInstallations || []) {
      this.slackInstallations.set(installation.teamId, installation);
    }
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

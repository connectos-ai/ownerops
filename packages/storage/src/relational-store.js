import {
  addWorkspaceUser,
  addSubtask,
  addTaskComment,
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
import { OWNEROPS_RELATIONAL_MIGRATIONS } from './relational-schema.js';

const BASE_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS ownerops_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function applyOwnerOpsMigrations(client, options = {}) {
  const migrations = options.migrations || OWNEROPS_RELATIONAL_MIGRATIONS;
  return withOwnerOpsTransaction(client, async (tx) => {
    await tx.query(BASE_MIGRATION_SQL);
    const existing = await tx.query('SELECT version FROM ownerops_schema_migrations ORDER BY version');
    const applied = new Set(resultRows(existing).map((row) => Number(row.version)));

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      await tx.query(migration.sql);
      await tx.query(
        `INSERT INTO ownerops_schema_migrations (version, name, applied_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING`,
        [migration.version, migration.name, new Date().toISOString()]
      );
      applied.add(migration.version);
    }

    return { appliedVersions: [...applied].sort((a, b) => a - b), currentVersion: Math.max(0, ...applied) };
  });
}

export async function withOwnerOpsTransaction(client, fn) {
  if (typeof client.transaction === 'function') {
    return client.transaction(fn);
  }

  const tx = typeof client.connect === 'function' ? await client.connect() : client;
  try {
    await tx.query('BEGIN');
    const result = await fn(tx);
    await tx.query('COMMIT');
    return result;
  } catch (error) {
    await tx.query('ROLLBACK');
    throw error;
  } finally {
    if (tx !== client && typeof tx.release === 'function') tx.release();
  }
}

export class RelationalOwnerOpsStore {
  constructor(options = {}) {
    if (!options.client) throw new Error('RelationalOwnerOpsStore requires a SQL client.');
    this.client = options.client;
  }

  async migrate() {
    return applyOwnerOpsMigrations(this.client);
  }

  async createWorkspace(input) {
    if (input?.id) {
      const existing = await this.getWorkspace(input.id);
      if (existing) return existing;
    }

    const workspace = createWorkspace(input);
    await this.client.query(
      `INSERT INTO workspaces (id, name, policies, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        workspace.id,
        workspace.name,
        toJson(workspace.policies || {}),
        workspace.createdAt,
        workspace.updatedAt
      ]
    );
    return workspace;
  }

  async getWorkspace(workspaceId) {
    const workspace = await queryOne(this.client, 'SELECT * FROM workspaces WHERE id = $1', [workspaceId]);
    if (!workspace) return null;

    const users = await queryRows(this.client, 'SELECT * FROM workspace_users WHERE workspace_id = $1', [workspaceId]);
    const projects = await queryRows(this.client, 'SELECT * FROM projects WHERE workspace_id = $1', [workspaceId]);
    const lists = await queryRows(this.client, 'SELECT * FROM task_lists WHERE workspace_id = $1', [workspaceId]);

    return {
      id: workspace.id,
      name: workspace.name,
      policies: parseJson(workspace.policies, {}),
      users: users.map(rowToWorkspaceUser),
      projects: projects.map(rowToProject),
      lists: lists.map(rowToTaskList),
      createdAt: toIso(workspace.created_at),
      updatedAt: toIso(workspace.updated_at)
    };
  }

  async requireWorkspace(workspaceId) {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) throw notFound('WORKSPACE_NOT_FOUND', 'Workspace not found.');
    return workspace;
  }

  async addWorkspaceUser(workspaceId, input) {
    const workspace = await this.requireWorkspace(workspaceId);
    const existing = workspace.users.find((user) => user.id === input?.id);
    if (existing) return existing;
    const user = addWorkspaceUser(workspace, input);
    await this.client.query(
      `INSERT INTO workspace_users
       (id, workspace_id, display_name, role, status, slack_user_id, email_hash, external_ids, invited_at, deactivated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (workspace_id, id) DO NOTHING`,
      [
        user.id,
        workspaceId,
        user.displayName,
        user.role,
        user.status,
        user.slackUserId || '',
        user.emailHash || '',
        toJson(user.externalIds || {}),
        user.invitedAt,
        user.deactivatedAt,
        user.createdAt,
        user.updatedAt
      ]
    );
    return user;
  }

  async updateWorkspaceUser(workspaceId, userId, input) {
    const workspace = await this.requireWorkspace(workspaceId);
    const user = updateWorkspaceUser(workspace, userId, input);
    await this.client.query(
      `UPDATE workspace_users
       SET display_name = $3, role = $4, status = $5, slack_user_id = $6, email_hash = $7,
           external_ids = $8, invited_at = $9, deactivated_at = $10, updated_at = $11
       WHERE workspace_id = $1 AND id = $2`,
      [
        workspaceId,
        user.id,
        user.displayName,
        user.role,
        user.status,
        user.slackUserId || '',
        user.emailHash || '',
        toJson(user.externalIds || {}),
        user.invitedAt,
        user.deactivatedAt,
        user.updatedAt
      ]
    );
    return user;
  }

  async deactivateWorkspaceUser(workspaceId, userId, input = {}) {
    const workspace = await this.requireWorkspace(workspaceId);
    const user = deactivateWorkspaceUser(workspace, userId, input);
    await this.client.query(
      `UPDATE workspace_users
       SET status = $3, deactivated_at = $4, updated_at = $5
       WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, user.id, user.status, user.deactivatedAt, user.updatedAt]
    );
    return user;
  }

  async createProject(workspaceId, input) {
    const workspace = await this.requireWorkspace(workspaceId);
    const existing = workspace.projects.find((project) => project.id === input?.id);
    if (existing) return existing;
    const project = createProject(workspace, input);
    await this.client.query(
      `INSERT INTO projects (id, workspace_id, name, description, owner_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (workspace_id, id) DO NOTHING`,
      [
        project.id,
        workspaceId,
        project.name,
        project.description || '',
        project.ownerId || null,
        project.status,
        project.createdAt,
        project.updatedAt
      ]
    );
    return project;
  }

  async createTaskList(workspaceId, input) {
    const workspace = await this.requireWorkspace(workspaceId);
    const existing = workspace.lists.find((list) => list.id === input?.id);
    if (existing) return existing;
    const list = createTaskList(workspace, input);
    await this.client.query(
      `INSERT INTO task_lists (id, workspace_id, project_id, name, description, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (workspace_id, id) DO NOTHING`,
      [
        list.id,
        workspaceId,
        list.projectId || null,
        list.name,
        list.description || '',
        list.sortOrder || 0,
        list.createdAt,
        list.updatedAt
      ]
    );
    return list;
  }

  async createTask(input) {
    await this.requireWorkspace(input.workspaceId);
    const existing = await this.findTaskBySource(input.workspaceId, input.sourceType, input.sourceReference);
    if (existing) return existing;
    const task = createTask(input);
    return this.updateTask(task);
  }

  async createTaskFromSuggestion(task) {
    return this.createTask(task);
  }

  async updateTask(task) {
    await withOwnerOpsTransaction(this.client, async (tx) => {
      await upsertTask(tx, task);
      await replaceTaskChildren(tx, task);
    });
    return this.getTask(task.workspaceId, task.id);
  }

  async getTask(workspaceId, taskId) {
    const row = await queryOne(
      this.client,
      'SELECT * FROM tasks WHERE workspace_id = $1 AND id = $2',
      [workspaceId, taskId]
    );
    if (!row) throw notFound('TASK_NOT_FOUND', 'Task not found.');
    return hydrateTask(this.client, row);
  }

  async listTasks(workspaceId, filters = {}) {
    await this.requireWorkspace(workspaceId);
    const rows = await queryRows(this.client, 'SELECT * FROM tasks WHERE workspace_id = $1', [workspaceId]);
    const tasks = [];
    for (const row of rows) tasks.push(await hydrateTask(this.client, row));
    return searchTasks(tasks, { ...filters, workspaceId });
  }

  async allTasks(workspaceId) {
    return this.listTasks(workspaceId, { includeArchived: true });
  }

  async findTaskBySource(workspaceId, sourceType, sourceReference) {
    if (!sourceReference) return null;
    const row = await queryOne(
      this.client,
      `SELECT * FROM tasks
       WHERE workspace_id = $1 AND source_type = $2 AND source_reference = $3`,
      [workspaceId, sourceType || 'manual', sourceReference]
    );
    return row ? hydrateTask(this.client, row) : null;
  }

  async addTaskComment(workspaceId, taskId, input) {
    const task = await this.getTask(workspaceId, taskId);
    return this.updateTask(addTaskComment(task, input));
  }

  async addSubtask(workspaceId, taskId, input) {
    const task = await this.getTask(workspaceId, taskId);
    return this.updateTask(addSubtask(task, input));
  }

  async archiveTask(workspaceId, taskId, input) {
    const task = await this.getTask(workspaceId, taskId);
    return this.updateTask(archiveTask(task, input));
  }

  async reopenTask(workspaceId, taskId, input) {
    const task = await this.getTask(workspaceId, taskId);
    return this.updateTask(reopenTask(task, input));
  }

  async saveSuggestion(suggestion) {
    const workspaceId = suggestion.workspaceId || suggestion.task?.workspaceId;
    if (!workspaceId) throw new Error('Suggestion workspaceId required.');
    await this.requireWorkspace(workspaceId);
    const receivedAt = suggestion.receivedAt || suggestion.source?.receivedAt || new Date().toISOString();
    await this.client.query(
      `INSERT INTO triage_suggestions
       (id, workspace_id, source_type, source_reference, subject, received_at, status, suggested_task, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (workspace_id, id) DO UPDATE SET
         status = EXCLUDED.status,
         suggested_task = EXCLUDED.suggested_task,
         metadata = EXCLUDED.metadata,
         updated_at = EXCLUDED.updated_at`,
      [
        suggestion.id,
        workspaceId,
        suggestion.source?.type || suggestion.sourceType || 'manual',
        suggestion.source?.messageId || suggestion.sourceReference || null,
        suggestion.source?.subject || suggestion.subject || '',
        receivedAt,
        suggestion.status || 'SUGGESTED',
        toJson(suggestion.task || null),
        toJson(suggestion),
        suggestion.createdAt || new Date().toISOString(),
        suggestion.updatedAt || new Date().toISOString()
      ]
    );
    return suggestion;
  }

  async getSuggestion(workspaceId, suggestionId) {
    const row = await queryOne(
      this.client,
      'SELECT * FROM triage_suggestions WHERE workspace_id = $1 AND id = $2',
      [workspaceId, suggestionId]
    );
    if (!row) throw notFound('SUGGESTION_NOT_FOUND', 'Suggestion not found.');
    return parseJson(row.metadata, {});
  }

  async hasProcessedSlackAction(idempotencyKey, input = {}) {
    const workspaceId = input.workspaceId || input;
    const row = await queryOne(
      this.client,
      'SELECT action_key FROM processed_slack_actions WHERE workspace_id = $1 AND action_key = $2',
      [workspaceId, idempotencyKey]
    );
    return Boolean(row);
  }

  async markProcessedSlackAction(idempotencyKey, input = {}) {
    const workspaceId = input.workspaceId || input;
    if (!workspaceId) throw new Error('Slack action workspaceId required.');
    await this.requireWorkspace(workspaceId);
    await this.client.query(
      `INSERT INTO processed_slack_actions (workspace_id, action_key, payload_fingerprint, processed_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, action_key) DO NOTHING`,
      [workspaceId, idempotencyKey, input.payloadFingerprint || '', input.processedAt || new Date().toISOString()]
    );
  }
}

async function upsertTask(client, task) {
  await client.query(
    `INSERT INTO tasks (
       id, workspace_id, title, description, desired_outcome, notes, source_type, source_reference,
       source_url, created_by, owner_id, requested_by, collaborators, status, priority, due_at,
       start_at, completed_at, blocked_reason, waiting_on, project_id, list_id, parent_task_id,
       tags, owner_decision_required, owner_decision_reason, confidence, recurrence, archived_at,
       version, created_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11, $12, $13, $14, $15, $16,
       $17, $18, $19, $20, $21, $22, $23,
       $24, $25, $26, $27, $28, $29,
       $30, $31, $32
     )
     ON CONFLICT (workspace_id, id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       desired_outcome = EXCLUDED.desired_outcome,
       notes = EXCLUDED.notes,
       source_type = EXCLUDED.source_type,
       source_reference = EXCLUDED.source_reference,
       source_url = EXCLUDED.source_url,
       owner_id = EXCLUDED.owner_id,
       requested_by = EXCLUDED.requested_by,
       collaborators = EXCLUDED.collaborators,
       status = EXCLUDED.status,
       priority = EXCLUDED.priority,
       due_at = EXCLUDED.due_at,
       start_at = EXCLUDED.start_at,
       completed_at = EXCLUDED.completed_at,
       blocked_reason = EXCLUDED.blocked_reason,
       waiting_on = EXCLUDED.waiting_on,
       project_id = EXCLUDED.project_id,
       list_id = EXCLUDED.list_id,
       parent_task_id = EXCLUDED.parent_task_id,
       tags = EXCLUDED.tags,
       owner_decision_required = EXCLUDED.owner_decision_required,
       owner_decision_reason = EXCLUDED.owner_decision_reason,
       confidence = EXCLUDED.confidence,
       recurrence = EXCLUDED.recurrence,
       archived_at = EXCLUDED.archived_at,
       version = EXCLUDED.version,
       updated_at = EXCLUDED.updated_at`,
    [
      task.id,
      task.workspaceId,
      task.title,
      task.description || '',
      task.desiredOutcome || '',
      task.notes || '',
      task.sourceType || 'manual',
      task.sourceReference || null,
      task.sourceUrl || '',
      task.createdBy || 'system',
      task.ownerId || 'unassigned',
      task.requestedBy || '',
      toJson(task.collaborators || []),
      task.status,
      task.priority,
      task.dueAt || null,
      task.startAt || null,
      task.completedAt || null,
      task.blockedReason || '',
      task.waitingOn || '',
      task.projectId || null,
      task.listId || null,
      task.parentTaskId || null,
      toJson(task.tags || []),
      Boolean(task.ownerDecisionRequired),
      task.ownerDecisionReason || '',
      task.confidence ?? null,
      task.recurrence ? toJson(task.recurrence) : null,
      task.archivedAt || null,
      task.version || 1,
      task.createdAt,
      task.updatedAt
    ]
  );
}

async function replaceTaskChildren(client, task) {
  await client.query('DELETE FROM task_comments WHERE workspace_id = $1 AND task_id = $2', [task.workspaceId, task.id]);
  await client.query('DELETE FROM task_subtasks WHERE workspace_id = $1 AND task_id = $2', [task.workspaceId, task.id]);
  await client.query('DELETE FROM task_history_events WHERE workspace_id = $1 AND task_id = $2', [task.workspaceId, task.id]);

  for (const comment of task.comments || []) {
    await client.query(
      `INSERT INTO task_comments (id, workspace_id, task_id, author_id, body, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        comment.id,
        task.workspaceId,
        task.id,
        comment.authorId,
        comment.body,
        comment.createdAt,
        comment.updatedAt
      ]
    );
  }

  for (const subtask of task.subtasks || []) {
    await client.query(
      `INSERT INTO task_subtasks (id, workspace_id, task_id, title, status, owner_id, due_at, completed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        subtask.id,
        task.workspaceId,
        task.id,
        subtask.title,
        subtask.status,
        subtask.ownerId || null,
        subtask.dueAt || null,
        subtask.completedAt || null,
        subtask.createdAt,
        subtask.updatedAt
      ]
    );
  }

  for (const event of task.history || []) {
    await client.query(
      `INSERT INTO task_history_events (id, workspace_id, task_id, event_type, actor_id, occurred_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.eventId,
        task.workspaceId,
        task.id,
        event.eventType,
        event.actorId || 'system',
        event.occurredAt,
        toJson(event)
      ]
    );
  }
}

async function hydrateTask(client, row) {
  const workspaceId = row.workspace_id;
  const taskId = row.id;
  const [comments, subtasks, history] = await Promise.all([
    queryRows(client, 'SELECT * FROM task_comments WHERE workspace_id = $1 AND task_id = $2', [workspaceId, taskId]),
    queryRows(client, 'SELECT * FROM task_subtasks WHERE workspace_id = $1 AND task_id = $2', [workspaceId, taskId]),
    queryRows(client, 'SELECT * FROM task_history_events WHERE workspace_id = $1 AND task_id = $2', [workspaceId, taskId])
  ]);

  return {
    id: row.id,
    workspaceId,
    title: row.title,
    description: row.description || '',
    desiredOutcome: row.desired_outcome || '',
    notes: row.notes || '',
    sourceType: row.source_type || 'manual',
    sourceReference: row.source_reference || '',
    sourceUrl: row.source_url || '',
    createdBy: row.created_by,
    ownerId: row.owner_id,
    requestedBy: row.requested_by || '',
    collaborators: parseJson(row.collaborators, []),
    status: row.status,
    priority: row.priority,
    dueAt: toNullableIso(row.due_at),
    startAt: toNullableIso(row.start_at),
    completedAt: toNullableIso(row.completed_at),
    blockedReason: row.blocked_reason || '',
    waitingOn: row.waiting_on || '',
    projectId: row.project_id || null,
    listId: row.list_id || null,
    parentTaskId: row.parent_task_id || null,
    tags: parseJson(row.tags, []),
    ownerDecisionRequired: Boolean(row.owner_decision_required),
    ownerDecisionReason: row.owner_decision_reason || '',
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    comments: comments.map(rowToComment),
    subtasks: subtasks.map(rowToSubtask),
    recurrence: parseJson(row.recurrence, null),
    archivedAt: toNullableIso(row.archived_at),
    history: history.map((event) => parseJson(event.payload, {
      eventId: event.id,
      eventType: event.event_type,
      actorId: event.actor_id,
      occurredAt: toIso(event.occurred_at)
    })),
    version: Number(row.version || 1),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function rowToWorkspaceUser(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    slackUserId: row.slack_user_id || '',
    emailHash: row.email_hash || '',
    externalIds: parseJson(row.external_ids, {}),
    invitedAt: row.invited_at ? toIso(row.invited_at) : null,
    deactivatedAt: row.deactivated_at ? toIso(row.deactivated_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function rowToProject(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description || '',
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function rowToTaskList(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id || null,
    name: row.name,
    description: row.description || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function rowToComment(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    body: row.body,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function rowToSubtask(row) {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id || null,
    status: row.status,
    dueAt: toNullableIso(row.due_at),
    completedAt: toNullableIso(row.completed_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function queryOne(client, sql, params = []) {
  const rows = await queryRows(client, sql, params);
  return rows[0] || null;
}

async function queryRows(client, sql, params = []) {
  return resultRows(await client.query(sql, params));
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  return result?.rows || [];
}

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : String(value || '');
}

function toNullableIso(value) {
  return value ? toIso(value) : null;
}

function notFound(code, message) {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = code;
  return error;
}

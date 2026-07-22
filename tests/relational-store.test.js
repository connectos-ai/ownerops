import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RelationalOwnerOpsStore,
  applyOwnerOpsMigrations
} from '../packages/storage/src/index.js';
import { approveSuggestedTask, triageEmailToTaskSuggestion } from '../packages/triage/src/index.js';

test('migration runner applies pending migrations once and records versions', async () => {
  const client = new MemorySqlClient();

  const first = await applyOwnerOpsMigrations(client, {
    migrations: [
      { version: 1, name: 'create_example', sql: 'CREATE TABLE IF NOT EXISTS example_one (id TEXT)' },
      { version: 2, name: 'add_example_index', sql: 'CREATE INDEX IF NOT EXISTS idx_example_one ON example_one (id)' }
    ]
  });
  const second = await applyOwnerOpsMigrations(client, {
    migrations: [
      { version: 1, name: 'create_example', sql: 'CREATE TABLE IF NOT EXISTS example_one (id TEXT)' },
      { version: 2, name: 'add_example_index', sql: 'CREATE INDEX IF NOT EXISTS idx_example_one ON example_one (id)' }
    ]
  });

  assert.deepEqual(first.appliedVersions, [1, 2]);
  assert.deepEqual(second.appliedVersions, [1, 2]);
  assert.equal(client.sqlCount('CREATE TABLE IF NOT EXISTS example_one'), 1);
  assert.equal(client.sqlCount('CREATE INDEX IF NOT EXISTS idx_example_one'), 1);
});

test('migration runner rolls back failed migration on plain SQL clients', async () => {
  const client = new RecordingSqlClient({ failOn: /BROKEN MIGRATION/ });

  await assert.rejects(
    () => applyOwnerOpsMigrations(client, {
      migrations: [{ version: 1, name: 'broken_migration', sql: 'BROKEN MIGRATION' }]
    }),
    /forced sql failure/
  );

  assert.deepEqual(client.statements, [
    'BEGIN',
    'CREATE TABLE IF NOT EXISTS ownerops_schema_migrations',
    'SELECT version FROM ownerops_schema_migrations ORDER BY version',
    'BROKEN MIGRATION',
    'ROLLBACK'
  ]);
});

test('relational store persists task lifecycle graph transactionally', async () => {
  const client = new MemorySqlClient();
  const store = new RelationalOwnerOpsStore({ client });

  await store.createWorkspace({ id: 'workspace_demo', name: 'Demo Team' });
  const task = await store.createTask({
    id: 'task_launch',
    workspaceId: 'workspace_demo',
    title: 'Prepare launch review',
    createdBy: 'user_owner',
    ownerId: 'user_ops',
    reviewerId: 'user_reviewer',
    approverId: 'user_owner',
    sourceType: 'email',
    sourceReference: 'email_demo_001',
    tags: ['launch']
  });

  await store.addTaskComment('workspace_demo', task.id, {
    id: 'comment_review',
    authorId: 'user_owner',
    body: 'Keep the review short.'
  });
  await store.addSubtask('workspace_demo', task.id, {
    id: 'subtask_outline',
    title: 'Write outline',
    ownerId: 'user_ops'
  });
  await store.archiveTask('workspace_demo', task.id, { actorId: 'user_owner' });

  const activeOnly = await store.listTasks('workspace_demo');
  const archived = await store.listTasks('workspace_demo', { includeArchived: true });
  const fromSource = await store.findTaskBySource('workspace_demo', 'email', 'email_demo_001');

  assert.deepEqual(activeOnly, []);
  assert.equal(archived.length, 1);
  assert.equal(archived[0].reviewerId, 'user_reviewer');
  assert.equal(archived[0].approverId, 'user_owner');
  assert.equal(archived[0].comments[0].body, 'Keep the review short.');
  assert.equal(archived[0].subtasks[0].title, 'Write outline');
  assert.ok(archived[0].history.some((event) => event.eventType === 'task.archived'));
  assert.equal(fromSource.id, task.id);

  client.failOn = /INSERT INTO task_comments/i;
  await assert.rejects(
    () => store.addTaskComment('workspace_demo', task.id, {
      id: 'comment_should_rollback',
      authorId: 'user_owner',
      body: 'This write should roll back.'
    }),
    /forced sql failure/
  );
  client.failOn = null;

  const afterRollback = await store.getTask('workspace_demo', task.id);
  assert.deepEqual(afterRollback.comments.map((comment) => comment.id), ['comment_review']);
});

test('relational store supports idempotent workspace setup records', async () => {
  const client = new MemorySqlClient();
  const store = new RelationalOwnerOpsStore({ client });

  await store.createWorkspace({ id: 'workspace_setup', name: 'Setup Team' });
  const owner = await store.addWorkspaceUser('workspace_setup', {
    id: 'user_owner',
    displayName: 'Owner'
  });
  const duplicateOwner = await store.addWorkspaceUser('workspace_setup', {
    id: 'user_owner',
    displayName: 'Owner'
  });
  const project = await store.createProject('workspace_setup', {
    id: 'project_ops',
    name: 'Operations',
    ownerId: 'user_owner'
  });
  const list = await store.createTaskList('workspace_setup', {
    id: 'list_today',
    name: 'Today',
    projectId: project.id
  });
  const workspace = await store.requireWorkspace('workspace_setup');

  assert.equal(owner.id, duplicateOwner.id);
  assert.deepEqual(workspace.users.map((user) => user.id), ['user_owner']);
  assert.deepEqual(workspace.projects.map((item) => item.id), ['project_ops']);
  assert.deepEqual(workspace.lists.map((item) => item.id), ['list_today']);
  assert.equal(workspace.lists[0].projectId, 'project_ops');
  assert.equal(list.sortOrder, 0);
});

test('relational store supports Slack idempotency and triage approval duplicate protection', async () => {
  const client = new MemorySqlClient();
  const store = new RelationalOwnerOpsStore({ client });

  await store.createWorkspace({ id: 'workspace_demo', name: 'Demo Team' });
  assert.equal(await store.hasProcessedSlackAction('action_demo', { workspaceId: 'workspace_demo' }), false);
  await store.markProcessedSlackAction('action_demo', {
    workspaceId: 'workspace_demo',
    payloadFingerprint: 'fingerprint_demo'
  });
  await store.markProcessedSlackAction('action_demo', {
    workspaceId: 'workspace_demo',
    payloadFingerprint: 'fingerprint_demo'
  });
  assert.equal(await store.hasProcessedSlackAction('action_demo', { workspaceId: 'workspace_demo' }), true);
  assert.equal(client.tables.processedSlackActions.length, 1);

  const suggestion = triageEmailToTaskSuggestion(
    {
      id: 'email_demo_001',
      subject: 'Follow up needed',
      from: 'customer@example.com',
      receivedAt: '2026-01-01T12:00:00.000Z',
      body: 'Please follow up with the customer by Friday.'
    },
    { workspaceId: 'workspace_demo', defaultOwnerId: 'user_owner' }
  );

  await store.saveSuggestion(suggestion);
  const savedSuggestion = await store.getSuggestion('workspace_demo', suggestion.id);
  const firstTask = await approveSuggestedTask(savedSuggestion, store, { actorId: 'user_owner' });
  const duplicateTask = await approveSuggestedTask(savedSuggestion, store, { actorId: 'user_owner' });

  assert.equal(savedSuggestion.source.messageId, 'email_demo_001');
  assert.equal(firstTask.id, duplicateTask.id);
  assert.equal((await store.listTasks('workspace_demo', { includeArchived: true })).length, 1);
});

class RecordingSqlClient {
  constructor(options = {}) {
    this.failOn = options.failOn || null;
    this.statements = [];
  }

  async query(sql) {
    this.statements.push(firstStatement(sql));
    if (this.failOn?.test(sql)) throw new Error('forced sql failure');
    return { rows: [] };
  }
}

class MemorySqlClient {
  constructor() {
    this.tables = {
      migrations: [],
      workspaces: new Map(),
      users: [],
      projects: [],
      lists: [],
      tasks: new Map(),
      comments: [],
      subtasks: [],
      history: [],
      suggestions: new Map(),
      processedSlackActions: []
    };
    this.statements = [];
    this.failOn = null;
  }

  async transaction(fn) {
    const snapshot = cloneTables(this.tables);
    try {
      return await fn(this);
    } catch (error) {
      this.tables = snapshot;
      throw error;
    }
  }

  async query(sql, params = []) {
    this.statements.push(firstStatement(sql));
    if (this.failOn?.test(sql)) throw new Error('forced sql failure');
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('create table') || normalized.startsWith('create index')) return { rows: [] };
    if (normalized.startsWith('select version from ownerops_schema_migrations')) return { rows: this.tables.migrations };
    if (normalized.startsWith('insert into ownerops_schema_migrations')) {
      if (!this.tables.migrations.some((row) => row.version === params[0])) {
        this.tables.migrations.push({ version: params[0], name: params[1], applied_at: params[2] });
      }
      return { rows: [] };
    }

    if (normalized.startsWith('insert into workspaces')) {
      this.tables.workspaces.set(params[0], {
        id: params[0],
        name: params[1],
        policies: params[2],
        created_at: params[3],
        updated_at: params[4]
      });
      return { rows: [] };
    }
    if (normalized.startsWith('select * from workspaces')) {
      return { rows: rowArray(this.tables.workspaces.get(params[0])) };
    }
    if (normalized.startsWith('insert into workspace_users')) {
      if (!this.tables.users.some((row) => row.workspace_id === params[1] && row.id === params[0])) {
        this.tables.users.push({
          id: params[0],
          workspace_id: params[1],
          display_name: params[2],
          role: params[3],
          status: params[4],
          slack_user_id: params[5],
          email_hash: params[6],
          external_ids: params[7],
          invited_at: params[8],
          deactivated_at: params[9],
          created_at: params[10],
          updated_at: params[11]
        });
      }
      return { rows: [] };
    }
    if (normalized.startsWith('update workspace_users')) {
      const row = this.tables.users.find((item) => item.workspace_id === params[0] && item.id === params[1]);
      if (row && normalized.includes('display_name')) {
        row.display_name = params[2];
        row.role = params[3];
        row.status = params[4];
        row.slack_user_id = params[5];
        row.email_hash = params[6];
        row.external_ids = params[7];
        row.invited_at = params[8];
        row.deactivated_at = params[9];
        row.updated_at = params[10];
      } else if (row) {
        row.status = params[2];
        row.deactivated_at = params[3];
        row.updated_at = params[4];
      }
      return { rows: [] };
    }
    if (normalized.startsWith('select * from workspace_users')) {
      return { rows: this.tables.users.filter((row) => row.workspace_id === params[0]) };
    }
    if (normalized.startsWith('insert into projects')) {
      if (!this.tables.projects.some((row) => row.workspace_id === params[1] && row.id === params[0])) {
        this.tables.projects.push({
          id: params[0],
          workspace_id: params[1],
          name: params[2],
          description: params[3],
          owner_id: params[4],
          status: params[5],
          created_at: params[6],
          updated_at: params[7]
        });
      }
      return { rows: [] };
    }
    if (normalized.startsWith('select * from projects')) {
      return { rows: this.tables.projects.filter((row) => row.workspace_id === params[0]) };
    }
    if (normalized.startsWith('insert into task_lists')) {
      if (!this.tables.lists.some((row) => row.workspace_id === params[1] && row.id === params[0])) {
        this.tables.lists.push({
          id: params[0],
          workspace_id: params[1],
          project_id: params[2],
          name: params[3],
          description: params[4],
          sort_order: params[5],
          created_at: params[6],
          updated_at: params[7]
        });
      }
      return { rows: [] };
    }
    if (normalized.startsWith('select * from task_lists')) {
      return { rows: this.tables.lists.filter((row) => row.workspace_id === params[0]) };
    }

    if (normalized.startsWith('insert into tasks')) {
      const row = taskRow(params);
      this.tables.tasks.set(`${row.workspace_id}:${row.id}`, row);
      return { rows: [] };
    }
    if (normalized.startsWith('select * from tasks where workspace_id = $1 and id = $2')) {
      return { rows: rowArray(this.tables.tasks.get(`${params[0]}:${params[1]}`)) };
    }
    if (normalized.startsWith('select * from tasks where workspace_id = $1 and source_type = $2')) {
      return {
        rows: [...this.tables.tasks.values()].filter((row) => (
          row.workspace_id === params[0]
          && row.source_type === params[1]
          && row.source_reference === params[2]
        ))
      };
    }
    if (normalized.startsWith('select * from tasks where workspace_id = $1')) {
      return { rows: [...this.tables.tasks.values()].filter((row) => row.workspace_id === params[0]) };
    }

    if (normalized.startsWith('delete from task_comments')) {
      this.tables.comments = this.tables.comments.filter((row) => row.workspace_id !== params[0] || row.task_id !== params[1]);
      return { rows: [] };
    }
    if (normalized.startsWith('delete from task_subtasks')) {
      this.tables.subtasks = this.tables.subtasks.filter((row) => row.workspace_id !== params[0] || row.task_id !== params[1]);
      return { rows: [] };
    }
    if (normalized.startsWith('delete from task_history_events')) {
      this.tables.history = this.tables.history.filter((row) => row.workspace_id !== params[0] || row.task_id !== params[1]);
      return { rows: [] };
    }
    if (normalized.startsWith('insert into task_comments')) {
      this.tables.comments.push({
        id: params[0],
        workspace_id: params[1],
        task_id: params[2],
        author_id: params[3],
        body: params[4],
        created_at: params[5],
        updated_at: params[6]
      });
      return { rows: [] };
    }
    if (normalized.startsWith('insert into task_subtasks')) {
      this.tables.subtasks.push({
        id: params[0],
        workspace_id: params[1],
        task_id: params[2],
        title: params[3],
        status: params[4],
        owner_id: params[5],
        due_at: params[6],
        completed_at: params[7],
        created_at: params[8],
        updated_at: params[9]
      });
      return { rows: [] };
    }
    if (normalized.startsWith('insert into task_history_events')) {
      this.tables.history.push({
        id: params[0],
        workspace_id: params[1],
        task_id: params[2],
        event_type: params[3],
        actor_id: params[4],
        occurred_at: params[5],
        payload: params[6]
      });
      return { rows: [] };
    }
    if (normalized.startsWith('select * from task_comments')) {
      return { rows: this.tables.comments.filter((row) => row.workspace_id === params[0] && row.task_id === params[1]) };
    }
    if (normalized.startsWith('select * from task_subtasks')) {
      return { rows: this.tables.subtasks.filter((row) => row.workspace_id === params[0] && row.task_id === params[1]) };
    }
    if (normalized.startsWith('select * from task_history_events')) {
      return { rows: this.tables.history.filter((row) => row.workspace_id === params[0] && row.task_id === params[1]) };
    }

    if (normalized.startsWith('insert into triage_suggestions')) {
      this.tables.suggestions.set(`${params[1]}:${params[0]}`, {
        id: params[0],
        workspace_id: params[1],
        source_type: params[2],
        source_reference: params[3],
        subject: params[4],
        received_at: params[5],
        status: params[6],
        suggested_task: params[7],
        metadata: params[8],
        created_at: params[9],
        updated_at: params[10]
      });
      return { rows: [] };
    }
    if (normalized.startsWith('select * from triage_suggestions')) {
      return { rows: rowArray(this.tables.suggestions.get(`${params[0]}:${params[1]}`)) };
    }

    if (normalized.startsWith('select action_key from processed_slack_actions')) {
      return {
        rows: this.tables.processedSlackActions.filter((row) => (
          row.workspace_id === params[0] && row.action_key === params[1]
        ))
      };
    }
    if (normalized.startsWith('insert into processed_slack_actions')) {
      const exists = this.tables.processedSlackActions.some((row) => (
        row.workspace_id === params[0] && row.action_key === params[1]
      ));
      if (!exists) {
        this.tables.processedSlackActions.push({
          workspace_id: params[0],
          action_key: params[1],
          payload_fingerprint: params[2],
          processed_at: params[3]
        });
      }
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in memory client: ${sql}`);
  }

  sqlCount(fragment) {
    return this.statements.filter((statement) => statement.includes(fragment)).length;
  }
}

function taskRow(params) {
  return {
    id: params[0],
    workspace_id: params[1],
    title: params[2],
    description: params[3],
    desired_outcome: params[4],
    notes: params[5],
    source_type: params[6],
    source_reference: params[7],
    source_url: params[8],
    created_by: params[9],
    owner_id: params[10],
    requested_by: params[11],
    reviewer_id: params[12],
    approver_id: params[13],
    collaborators: params[14],
    status: params[15],
    priority: params[16],
    due_at: params[17],
    start_at: params[18],
    completed_at: params[19],
    blocked_reason: params[20],
    waiting_on: params[21],
    project_id: params[22],
    list_id: params[23],
    parent_task_id: params[24],
    tags: params[25],
    owner_decision_required: params[26],
    owner_decision_reason: params[27],
    confidence: params[28],
    recurrence: params[29],
    archived_at: params[30],
    version: params[31],
    created_at: params[32],
    updated_at: params[33]
  };
}

function rowArray(row) {
  return row ? [row] : [];
}

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, ' ').trim().toLowerCase();
}

function firstStatement(sql) {
  return String(sql).replace(/\s+/g, ' ').trim().split('(')[0].trim();
}

function cloneTables(tables) {
  return {
    migrations: tables.migrations.map((row) => ({ ...row })),
    workspaces: new Map([...tables.workspaces.entries()].map(([key, value]) => [key, { ...value }])),
    users: tables.users.map((row) => ({ ...row })),
    projects: tables.projects.map((row) => ({ ...row })),
    lists: tables.lists.map((row) => ({ ...row })),
    tasks: new Map([...tables.tasks.entries()].map(([key, value]) => [key, { ...value }])),
    comments: tables.comments.map((row) => ({ ...row })),
    subtasks: tables.subtasks.map((row) => ({ ...row })),
    history: tables.history.map((row) => ({ ...row })),
    suggestions: new Map([...tables.suggestions.entries()].map(([key, value]) => [key, { ...value }])),
    processedSlackActions: tables.processedSlackActions.map((row) => ({ ...row }))
  };
}

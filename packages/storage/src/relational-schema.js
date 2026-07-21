export const OWNEROPS_RELATIONAL_SCHEMA_VERSION = 1;

export const OWNEROPS_RELATIONAL_REQUIRED_TABLES = Object.freeze([
  'ownerops_schema_migrations',
  'workspaces',
  'workspace_users',
  'projects',
  'task_lists',
  'tasks',
  'task_comments',
  'task_subtasks',
  'task_history_events',
  'triage_suggestions',
  'processed_slack_actions',
  'slack_installations'
]);

export const OWNEROPS_RELATIONAL_REQUIRED_INDEXES = Object.freeze([
  'idx_workspace_users_workspace_id',
  'idx_projects_workspace_id',
  'idx_task_lists_workspace_id',
  'idx_tasks_workspace_status',
  'idx_tasks_workspace_owner',
  'idx_tasks_workspace_due',
  'idx_tasks_workspace_project',
  'idx_tasks_workspace_list',
  'idx_task_comments_workspace_task',
  'idx_task_subtasks_workspace_task',
  'idx_task_history_events_workspace_task',
  'idx_triage_suggestions_workspace_status',
  'idx_processed_slack_actions_workspace',
  'idx_slack_installations_workspace_id'
]);

export const OWNEROPS_RELATIONAL_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'create_ownerops_workspace_task_schema',
    sql: `
CREATE TABLE IF NOT EXISTS ownerops_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  policies JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_users (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS task_lists (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  desired_outcome TEXT,
  source_type TEXT,
  source_reference TEXT,
  source_url TEXT,
  created_by TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  requested_by TEXT,
  collaborators JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  start_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  blocked_reason TEXT,
  waiting_on TEXT,
  project_id TEXT,
  list_id TEXT,
  parent_task_id TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_decision_required BOOLEAN NOT NULL DEFAULT false,
  owner_decision_reason TEXT,
  confidence NUMERIC,
  recurrence JSONB,
  archived_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id, list_id) REFERENCES task_lists(workspace_id, id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id, parent_task_id) REFERENCES tasks(workspace_id, id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_workspace_source_reference
  ON tasks (workspace_id, source_type, source_reference)
  WHERE source_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, task_id) REFERENCES tasks(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_subtasks (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_id TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, task_id) REFERENCES tasks(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_history_events (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, task_id) REFERENCES tasks(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS triage_suggestions (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  status TEXT NOT NULL,
  suggestion JSONB NOT NULL,
  decision JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, id)
);

CREATE TABLE IF NOT EXISTS processed_slack_actions (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, action_key)
);

CREATE TABLE IF NOT EXISTS slack_installations (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_team_id TEXT NOT NULL,
  slack_team_name TEXT,
  slack_enterprise_id TEXT,
  encrypted_credentials JSONB NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  installed_by TEXT,
  installed_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id),
  UNIQUE (slack_team_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_id ON workspace_users (workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_workspace_id ON task_lists (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON tasks (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_owner ON tasks (workspace_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_due ON tasks (workspace_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_project ON tasks (workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_list ON tasks (workspace_id, list_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_workspace_task ON task_comments (workspace_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_workspace_task ON task_subtasks (workspace_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_events_workspace_task ON task_history_events (workspace_id, task_id);
CREATE INDEX IF NOT EXISTS idx_triage_suggestions_workspace_status ON triage_suggestions (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_processed_slack_actions_workspace ON processed_slack_actions (workspace_id, processed_at);
CREATE INDEX IF NOT EXISTS idx_slack_installations_workspace_id ON slack_installations (workspace_id);
`
  })
]);

export function getRelationalSchemaSql(migrations = OWNEROPS_RELATIONAL_MIGRATIONS) {
  return migrations.map((migration) => migration.sql.trim()).join('\n\n');
}

export function validateRelationalSchema(migrations = OWNEROPS_RELATIONAL_MIGRATIONS) {
  const errors = [];
  const versions = new Set();
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const sql = getRelationalSchemaSql(ordered);

  ordered.forEach((migration, index) => {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      errors.push(`Migration ${migration.name || index} has an invalid version.`);
    }
    if (versions.has(migration.version)) {
      errors.push(`Migration version ${migration.version} is duplicated.`);
    }
    versions.add(migration.version);
    if (migration.version !== index + 1) {
      errors.push(`Migration ${migration.name} should be version ${index + 1}.`);
    }
    if (!migration.name || !/^[a-z0-9_]+$/.test(migration.name)) {
      errors.push(`Migration version ${migration.version} needs a stable snake_case name.`);
    }
    if (!migration.sql || typeof migration.sql !== 'string') {
      errors.push(`Migration ${migration.name} is missing SQL.`);
    }
  });

  for (const table of OWNEROPS_RELATIONAL_REQUIRED_TABLES) {
    if (!new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\b`, 'i').test(sql)) {
      errors.push(`Missing table: ${table}`);
    }
  }

  for (const index of OWNEROPS_RELATIONAL_REQUIRED_INDEXES) {
    if (!new RegExp(`CREATE INDEX IF NOT EXISTS\\s+${index}\\b`, 'i').test(sql)) {
      errors.push(`Missing index: ${index}`);
    }
  }

  for (const column of findDisallowedPlaintextSecretColumns(sql)) {
    errors.push(`Secret-like column must be encrypted or renamed: ${column}`);
  }

  return {
    ok: errors.length === 0,
    currentVersion: Math.max(0, ...ordered.map((migration) => migration.version)),
    errors
  };
}

export function findDisallowedPlaintextSecretColumns(sql) {
  const disallowed = [];
  const columnPattern = /^\s*([a-z_][a-z0-9_]*)\s+(TEXT|VARCHAR|JSONB|JSON|BYTEA)\b/gim;
  const secretPattern = /(access_token|bot_token|refresh_token|signing_secret|client_secret|private_key|oauth_token|password)/i;

  for (const match of sql.matchAll(columnPattern)) {
    const columnName = match[1];
    if (secretPattern.test(columnName) && !/^encrypted_/.test(columnName) && !/_encrypted$/.test(columnName)) {
      disallowed.push(columnName);
    }
  }

  return disallowed;
}

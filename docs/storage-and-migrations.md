# Storage And Migrations

OwnerOps ships two storage paths:

- Portable JSON file store for local development and small self-hosted trials.
- PostgreSQL-compatible relational storage for production deployments.

The production persistence shape is defined as versioned SQL migrations in `packages/storage/src/relational-schema.js`. The runtime adapter and migration runner live in `packages/storage/src/relational-store.js`, with optional PostgreSQL wiring in `packages/storage/src/postgres.js`.

## Current Boundary

The relational schema and adapter cover:

- Schema migration tracking.
- Workspaces and workspace users.
- Projects and task lists.
- Tasks, comments, subtasks, and history events.
- Triage suggestions.
- Slack action idempotency.
- Slack installations with encrypted credential records only.

Every task-facing table is workspace-scoped. Indexes are defined for common workspace filters: status, owner, due date, project, list, task history, triage status, Slack actions, and Slack installations.

## Migration Runner

Run migrations against a PostgreSQL-compatible database:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops npm run db:migrate
```

The runner creates the migration tracking table first, applies only pending migrations, runs inside a transaction, records each applied version, and rolls back if a migration fails.

## Relational Store

`RelationalOwnerOpsStore` accepts an injected SQL client with a `query(sql, params)` method and optional `connect()` or `transaction(fn)` support. This keeps the core storage boundary testable without requiring contributors to run PostgreSQL for every local test.

Current relational store coverage includes:

- Workspace creation and loading.
- Task create, update, list, source-reference lookup, comments, subtasks, archive, and reopen.
- Triage suggestion save/load and email-to-task duplicate protection by source reference.
- Slack action idempotency persistence.
- Transactional task graph writes so child rows roll back with parent task update.

## Security Rules

- Do not add plaintext token columns.
- Store integration credentials as encrypted records, not raw OAuth or signing secret fields.
- Keep tenant isolation explicit with `workspace_id`.
- Keep source references unique per workspace when present.
- Do not commit database dumps, runtime data, backups, logs, or `.env` files.

## Pending Production Work

Before public release gate can pass, OwnerOps still needs:

- Default database-backed server runtime selection.
- Database backup restore documentation and restore-test.
- Hosted CI evidence schema checks run cleanly.

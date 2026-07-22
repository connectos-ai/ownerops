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

## Database Runtime

Run the API with PostgreSQL persistence by explicitly selecting the storage mode:

```bash
OWNEROPS_STORAGE=postgres DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops node apps/api/src/server.js
```

`DATABASE_URL` alone does not change local JSON or in-memory behavior. This keeps OwnerOps simple for standalone local use while allowing production deployments to opt into the relational store deliberately.

## Database Backup And Restore

Production PostgreSQL deployments use standard PostgreSQL client tools:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops npm run db:backup
OWNEROPS_RESTORE_CONFIRM=restore-ownerops-database OWNEROPS_RESTORE_DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops_restore_target npm run db:restore -- backups/database/ownerops-db-example.dump
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops OWNEROPS_RESTORE_TEST_DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops_restore_test npm run db:restore-test
```

`db:backup` writes a custom-format `pg_dump` plus checksum. `db:restore` verifies a sibling checksum when present and requires `OWNEROPS_RESTORE_CONFIRM=restore-ownerops-database`. `db:restore-test` backs up the source, restores into a separate target database, and checks core OwnerOps tables before reporting success.

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

- Hosted CI evidence schema checks run cleanly.

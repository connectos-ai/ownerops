# Storage And Migrations

OwnerOps currently ships with a portable JSON file store for local development and small self-hosted trials. The production persistence boundary is now defined as versioned PostgreSQL-compatible migration SQL in `packages/storage/src/relational-schema.js`.

This boundary is intentionally not a required database service yet. It documents the production shape that future adapters and migration runners must honor while keeping the public repo useful without Docker, cloud services, DoBoth, ConnectOS, Slack, email, or AI.

## Current Boundary

The relational schema covers:

- Schema migration tracking.
- Workspaces and workspace users.
- Projects and task lists.
- Tasks, comments, subtasks, and history events.
- Triage suggestions.
- Slack action idempotency.
- Slack installations with encrypted credential records only.

Every task-facing table is workspace-scoped. Indexes are defined for common workspace filters such as status, owner, due date, project, list, task history, triage status, Slack actions, and Slack installations.

## Security Rules

- Do not add plaintext token columns.
- Store integration credentials as encrypted records, not as raw OAuth or signing secret fields.
- Keep tenant isolation explicit with `workspace_id`.
- Keep source references unique per workspace when they are present.
- Do not commit database dumps, runtime data, backups, logs, or `.env` files.

## Pending Production Work

Before the public release gate can pass, OwnerOps still needs:

- A production database adapter.
- A migration runner.
- Transaction tests for task writes, Slack idempotency, and triage approvals.
- Database backup and restore documentation with a restore-test.
- Hosted CI evidence that the schema checks run cleanly.

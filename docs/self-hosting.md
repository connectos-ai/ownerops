# Self-Hosting

OwnerOps can currently run as a local HTTP API with in-memory storage or a portable JSON file store. This is useful for development and small self-hosted trials. The public candidate now also includes the production relational storage adapter and migration runner, but the HTTP server is not wired to use that async adapter by default yet.

## Local Persistent Mode

Run a project-relative JSON data file:

```bash
OWNEROPS_PORT=3100 OWNEROPS_DATA_FILE=data/ownerops.json node apps/api/src/server.js
```

Open standalone task manager at `http://localhost:3100/`. The web app uses same local API and does not require Slack, email, AI, DoBoth, or ConnectOS.

`data/` directory is intentionally ignored by git. Do not commit runtime data, backups, logs, database dumps, or environment files.

## Back Up Data

```bash
OWNEROPS_DATA_FILE=data/ownerops.json OWNEROPS_BACKUP_DIR=backups scripts/backup-data.sh
```

The script validates the data file JSON, copies it into `backups/`, and writes a checksum file beside it.

## Restore Data

Stop OwnerOps first, then run:

```bash
OWNEROPS_DATA_FILE=data/ownerops.json scripts/restore-data.sh backups/ownerops-example.json
```

If an existing data file is present, the restore script first saves a pre-restore copy under `backups/pre-restore/`.

## Production Direction

The JSON store is a simple portable development store. Slack installation tokens are encrypted before they enter a JSON snapshot.

OwnerOps includes a production relational schema boundary in `packages/storage/src/relational-schema.js`, a relational adapter in `packages/storage/src/relational-store.js`, and PostgreSQL wiring in `packages/storage/src/postgres.js`. This defines expected PostgreSQL-compatible tables, indexes, workspace isolation, encrypted credential storage shape, transaction behavior, and migration runner without making database mandatory for local JSON use.

Run relational migrations:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops npm run db:migrate
```

Production self-hosting still needs HTTP API wiring for relational storage plus database backup/restore procedures before public release `PASS`.

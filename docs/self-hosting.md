# Self-Hosting

OwnerOps can run as a local HTTP API with in-memory storage, a portable JSON file store, or an explicitly selected PostgreSQL-compatible store. The default remains local and project-relative so new contributors can try OwnerOps without running a database.

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

Run the API with the database store:

```bash
OWNEROPS_STORAGE=postgres DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops node apps/api/src/server.js
```

`DATABASE_URL` alone does not switch local development into database mode. Set `OWNEROPS_STORAGE=postgres` intentionally when you want the server to use PostgreSQL.

Production self-hosting still needs database backup/restore procedures before public release `PASS`.

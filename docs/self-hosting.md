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

## Database Backup

Install PostgreSQL client tools so `pg_dump`, `pg_restore`, and `psql` are available. Create a custom-format backup:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops npm run db:backup
```

By default, backups are written under `backups/database/` with a `.sha256` checksum beside the dump. Set `OWNEROPS_DATABASE_BACKUP_DIR` to choose a different ignored backup folder.

## Database Restore

Restore is intentionally explicit because it can replace target database contents:

```bash
OWNEROPS_RESTORE_CONFIRM=restore-ownerops-database OWNEROPS_RESTORE_DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops_restore_target npm run db:restore -- backups/database/ownerops-db-example.dump
```

If `backup.dump.sha256` exists, restore verifies it before calling `pg_restore`.

## Database Restore Test

Before copying a production deployment, restore the fresh backup into an isolated test database and verify required OwnerOps tables exist:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops OWNEROPS_RESTORE_TEST_DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops_restore_test npm run db:restore-test
```

The restore-test refuses to use the same source and target URL. Create and clear the restore-test database outside OwnerOps using your normal PostgreSQL operations.

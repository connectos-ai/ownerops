# Self-Hosting

OwnerOps can currently run as a dependency-free local HTTP API. This is useful for development and small self-hosted trials. The current public candidate still needs a production relational storage layer before release gate `PASS`.

## Local Persistent Mode

Run with a project-relative JSON data file:

```bash
OWNEROPS_PORT=3100 OWNEROPS_DATA_FILE=data/ownerops.json node apps/api/src/server.js
```

The `data/` directory is intentionally ignored by git. Do not commit runtime data, backups, logs, database dumps, or environment files.

## Back Up Data

```bash
OWNEROPS_DATA_FILE=data/ownerops.json OWNEROPS_BACKUP_DIR=backups scripts/backup-data.sh
```

The script validates that the data file is JSON, copies it into `backups/`, and writes a checksum file beside it.

## Restore Data

Stop OwnerOps first, then run:

```bash
OWNEROPS_DATA_FILE=data/ownerops.json scripts/restore-data.sh backups/ownerops-example.json
```

If an existing data file is present, the restore script first saves a pre-restore copy under `backups/pre-restore/`.

## Production Direction

The JSON store is a simple portable development store. Production self-hosting should move to a transactional database with migrations, encrypted token storage, workspace isolation, and tested backup/restore procedures before public release `PASS`.

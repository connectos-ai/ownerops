# Deployment

OwnerOps can be deployed as a small self-hosted HTTP service. The standalone task
manager and API are useful without Slack, email, AI, DoBoth, or ConnectOS.

## Deployment Shapes

### Local Trial

Use in-memory or project-relative JSON storage:

```bash
OWNEROPS_PORT=3100 OWNEROPS_DATA_FILE=data/ownerops.json node apps/api/src/server.js
```

Use this for evaluation, demos, and contributor development.

### Private Team Deployment

For a small team, run OwnerOps behind private network access or reverse-proxy
authentication. Set:

```bash
OWNEROPS_API_TOKEN=replace-with-long-random-value
OWNEROPS_TOKEN_ENCRYPTION_KEY=replace-with-32-byte-base64-key
OWNEROPS_DATA_FILE=data/ownerops.json
OWNEROPS_PORT=3100
```

Send `Authorization: Bearer <OWNEROPS_API_TOKEN>` to protected `/api/*` routes.
Slack webhook routes use Slack request signatures instead.

### PostgreSQL Deployment

Use PostgreSQL when multiple users, Slack installations, or production retention
matter:

```bash
OWNEROPS_STORAGE=postgres DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops node apps/api/src/server.js
```

Run migrations before first start:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops npm run db:migrate
```

`DATABASE_URL` alone does not switch storage mode. Set
`OWNEROPS_STORAGE=postgres` intentionally.

## Required Production Controls

- Keep OwnerOps behind HTTPS.
- Set `OWNEROPS_API_TOKEN` for exposed API routes.
- Set `OWNEROPS_TOKEN_ENCRYPTION_KEY` before Slack OAuth or provider tokens.
- Store secrets in deployment environment or secret manager, never git.
- Back up data before upgrades, moves, or schema changes.
- Run restore-test against an isolated target before migration cutovers.
- Keep logs free of email bodies, Slack messages, tokens, authorization headers,
  cookies, raw prompts, and database URLs.

## Backup Before Move

JSON deployment:

```bash
OWNEROPS_DATA_FILE=data/ownerops.json OWNEROPS_BACKUP_DIR=backups scripts/backup-data.sh
```

PostgreSQL deployment:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops npm run db:backup
```

Restore-test PostgreSQL backup:

```bash
DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops OWNEROPS_RESTORE_TEST_DATABASE_URL=postgres://ownerops:change-me@localhost:5432/ownerops_restore_test npm run db:restore-test
```

## GitHub Publication Gate

This repository should not be pushed or published until
`docs/security/public-release-security-audit.md` says `PASS`. See
`docs/github-launch-runbook.md` for the authenticated GitHub sequence.

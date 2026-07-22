# Troubleshooting

Start with the local gate:

```bash
npm ci
npm run ci
```

## API Does Not Start

Check:

- Node.js version supports the test runner and current syntax.
- `OWNEROPS_PORT` is not already in use.
- `OWNEROPS_DATA_FILE` parent directory exists when using file storage.
- `OWNEROPS_STORAGE=postgres` is set only when PostgreSQL is intended.
- `DATABASE_URL` points to a reachable database when PostgreSQL mode is enabled.

## Web App Loads But Tasks Fail

Check:

- API server is running.
- Browser is using the same origin and port as the API.
- If `OWNEROPS_API_TOKEN` is set, browser access should be behind a proxy that
  handles authentication. The static app does not store bearer tokens.

## Slack Requests Fail

Check:

- Slack signing secret is configured in the deployment environment.
- Request timestamp is not stale.
- Raw request body is used for signature verification before parsing.
- Slack team is mapped to the intended OwnerOps workspace.
- Retry handling uses idempotency keys so duplicate Slack deliveries do not
  create duplicate tasks.

## Slack OAuth Fails

Check:

- Redirect URL in Slack app settings matches deployed callback URL.
- OAuth state signing secret is configured.
- OAuth state has not expired.
- Token encryption key is configured before storing installation tokens.
- Workspace uninstall or token revocation events did not revoke installation.

## Email Triage Creates Wrong Suggestions

Check:

- Source content is authorized and expected.
- Deterministic fallback rules are enabled when no AI provider is configured.
- AI output is treated as recommendation, not authority.
- Workspace policy controls whether suggestions are auto-created or require
  approval.
- Duplicate detection uses source reference and workspace context.

## PostgreSQL Migration Fails

Check:

- `DATABASE_URL` points to the intended database.
- Database user can create tables and write migration tracking rows.
- No previous partial migration remains outside a transaction.
- Backups exist before retrying production migration.

## Restore-Test Fails

Check:

- Source and restore-test database URLs are different.
- PostgreSQL client tools are installed.
- Backup has a sibling `.sha256` checksum file.
- Restore-test target database exists and can be safely replaced.

## Public Release Gate Fails

The release gate intentionally fails if:

- Working tree is dirty.
- Current branch is not `main`.
- A remote is configured before authenticated publication inspection.
- Local CI, whitespace, dependency audit, or public release audit fails.

Fix the reported item, then rerun:

```bash
npm run release:local-gate
```

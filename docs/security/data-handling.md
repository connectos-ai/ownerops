# Data Handling

OwnerOps handles operational work. Treat task content, source references, owner
decisions, Slack data, email data, provider credentials, and backups as sensitive.

## Data Classes

| Data | Examples | Handling |
| --- | --- | --- |
| Task data | titles, descriptions, status, due dates, owners | Workspace-scoped; backed up; not public |
| Source metadata | email thread IDs, Slack links, sender labels | Store minimal references; avoid bodies by default |
| Credentials | OAuth tokens, Slack tokens, signing secrets | Environment or encrypted credential records only |
| AI inputs | authorized message snippets, summaries | Send only when AI configured and policy allows |
| Logs | request IDs, event names, durations, error classes | No full message bodies, tokens, prompts, or credentials |
| Backups | JSON snapshots, PostgreSQL dumps | Store outside git; checksum; restore-test before moves |

## Log Redaction

`packages/observability/src/index.js` provides dependency-free helpers for safe
log event shaping:

- `redactString(value)` removes common secret-shaped values and email addresses.
- `redactLogValue(value)` recursively redacts sensitive keys such as tokens,
  cookies, authorization headers, message bodies, prompts, attachments, and
  database URLs.
- `createSafeLogEvent(event)` preserves operational metadata while redacting
  payload data.

Coverage lives in `tests/observability-redaction.test.js`.

## Collection Principles

- Collect only what task triage, assignment, follow-up, and brief generation need.
- Preserve source references so users can inspect authorized originals.
- Do not copy attachment contents unless a future feature explicitly requires it
  and documents retention.
- Keep AI provider usage optional and transparent to operators.

## Storage Principles

- Use project-relative ignored `data/` for local JSON trials.
- Use PostgreSQL-compatible store for production deployments.
- Scope durable rows by workspace.
- Store integration tokens as encrypted records.
- Keep backups under ignored backup directories.

## Sharing Principles

- Slack Free native templates are manual workspace conventions, not public data
  exports.
- Slack Enhanced Mode should post only task-safe summaries, source links, and
  authorized task fields.
- DoBoth and ConnectOS integrations must use public APIs, events, and adapters
  with the same authorization boundaries as any other consumer.

## Deletion And Retention

Current public candidate supports task archive/reopen and restore procedures. A
future production release should add explicit retention policies, workspace data
export, and workspace deletion workflow before hosted multi-tenant operation.

## Public Repository Rules

Never commit:

- `.env` or `.env.*` with real values.
- Backups, logs, runtime data, database dumps, exports.
- Slack/Gmail/Microsoft tokens, signing secrets, OAuth refresh tokens.
- Private keys, cookies, webhook secrets, API keys.
- Real client, church, personal, workspace, message, calendar, or mailbox data.

# Threat Model

Date: 2026-07-22

Scope: public OwnerOps release candidate.

## Assets

- Workspace task data.
- Email and Slack source references.
- Owner decision context.
- OAuth tokens and provider credentials.
- Slack signing secrets and token encryption keys.
- Database contents and backups.
- API bearer token when configured.
- Audit and task history.

## Trust Boundaries

- Browser or API client to OwnerOps HTTP API.
- Slack requests to Slack webhook routes.
- Slack OAuth redirect to OwnerOps callback.
- Email or communication provider payloads to triage.
- Optional AI provider requests and responses.
- OwnerOps application to JSON file or PostgreSQL database.
- Backup and restore scripts to filesystem or database.
- Future webhooks or event consumers.

## STRIDE Summary

| Threat | Risk | Current Controls | Remaining Work |
| --- | --- | --- | --- |
| Spoofing | Fake API caller or fake Slack request mutates tasks | Optional `OWNEROPS_API_TOKEN`; Slack signature verification; signed OAuth state | First-party user auth and role checks |
| Tampering | Retry or forged event changes task state twice | Slack idempotency tests; source duplicate protection; workspace-scoped records | Webhook signing when event delivery is added |
| Repudiation | User denies task or decision change | Task history and events in core model | Richer audit export and admin view |
| Information disclosure | Email, Slack, token, or prompt leaks through logs or public repo | Public audit script; encrypted token records; data-handling rules; redaction utility tests | More integration points should call redaction helpers as logging grows |
| Denial of service | Large payloads or repeated requests overwhelm local API | Slack timing/idempotency design; small dependency surface | Rate limits for exposed deployments |
| Elevation of privilege | Cross-workspace request mutates another workspace | Workspace-scoped store and Slack team mapping tests | Full role-based authorization |

## AI And Prompt Injection

Email and Slack content are untrusted. AI output must be parsed as data,
validated, and checked against workspace policy. AI suggestions must not bypass
authorization, approval requirements, or side-effect controls.

## Security Release Rules

- Never commit `.env`, backups, logs, runtime data, or credential exports.
- Never store OAuth tokens in plaintext.
- Never log full email bodies, Slack messages, authorization headers, cookies,
  database URLs, raw prompts, or credentials.
- Keep OwnerOps deployable without AI, Slack, email, DoBoth, or ConnectOS.
- Keep DoBoth and ConnectOS on public APIs, events, and adapters only.

## Required Before Public PASS

- Authenticated GitHub repository inspection or safe creation.
- GitHub-hosted CI evidence.
- Final working-tree and history privacy scan.
- `docs/security/public-release-security-audit.md` changed to `PASS` only when
  critical and high-risk findings are resolved.

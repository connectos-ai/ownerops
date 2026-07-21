# Slack Enhanced App

OwnerOps Enhanced Mode adds a Slack app service on top of the standalone task engine. Slack is an operating surface, not the canonical database. The canonical task remains in OwnerOps storage and Slack interactions update that task through public application services.

## Current Implemented Slice

The current public candidate implements:

- `POST /slack/events` with Slack request signature verification.
- Slack URL verification challenge response.
- `POST /slack/interactions` with Slack request signature verification.
- A first Block Kit action handler, `ownerops_task_status`, that updates a canonical task status.
- Idempotency for retried Slack actions.
- Optional Slack team-to-OwnerOps workspace scoping using `workspace.policies.slackTeamId`.

The current slice does not yet implement Slack OAuth, token storage, App Home, message shortcuts, slash commands, modals, or outgoing Slack API calls.

## Request Verification

Slack request verification uses the official signing secret flow:

- Read the raw request body before parsing it.
- Read `X-Slack-Request-Timestamp`.
- Reject timestamps outside a five-minute tolerance.
- Build `v0:{timestamp}:{rawBody}`.
- HMAC SHA256 with `OWNEROPS_SLACK_SIGNING_SECRET`.
- Compare with `X-Slack-Signature` using constant-time comparison.

Reference: https://docs.slack.dev/authentication/verifying-requests-from-slack/

Slack Events API requests should receive a `2xx` response within three seconds. OwnerOps should keep Slack handlers short and move longer work to a worker queue as the enhanced app grows.

Reference: https://docs.slack.dev/apis/events-api/

## Status Action

The implemented `ownerops_task_status` interaction expects an action value shaped like:

```json
{
  "workspaceId": "workspace_demo",
  "taskId": "task_example",
  "status": "DONE"
}
```

For `BLOCKED` and `WAITING`, include the normal task status fields:

```json
{
  "workspaceId": "workspace_demo",
  "taskId": "task_example",
  "status": "WAITING",
  "waitingOn": "Customer reply"
}
```

## Workspace Scoping

When a workspace has `policies.slackTeamId`, Slack interaction payloads must come from the same Slack team ID. This is a first guardrail, not a complete authorization system. Full release still requires Slack OAuth installation records, role checks, token encryption, uninstall handling, and audit events for sensitive actions.

## Retry Handling

Slack may retry requests. OwnerOps stores a processed Slack action key using the Slack team ID, user ID, action ID, workspace ID, task ID, status, and action timestamp. A retried action receives an ephemeral already-handled response instead of applying the status update twice.

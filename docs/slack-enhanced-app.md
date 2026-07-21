# Slack Enhanced App

OwnerOps Enhanced Mode adds a Slack app service on top of the standalone task engine. Slack is an operating surface, not the canonical database. The canonical task remains in OwnerOps storage, and Slack interactions update that task through public application services.

## Current Implemented Slice

The current public candidate implements:

- `POST /slack/events` with Slack request signature verification.
- Slack URL verification challenge response.
- `POST /slack/interactions` with Slack request signature verification.
- Message shortcut handling for `ownerops_turn_message_into_task`.
- Block Kit action handling for `ownerops_task_status`.
- Idempotency for retried Slack actions.
- Optional Slack team-to-OwnerOps workspace scoping using `workspace.policies.slackTeamId`.

The current slice does not yet implement Slack OAuth, token storage, App Home, slash commands, modals, or outgoing Slack API calls.

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

## Message Shortcut: Turn Message Into Task

The implemented message shortcut expects:

```json
{
  "type": "message_action",
  "callback_id": "ownerops_turn_message_into_task",
  "team": { "id": "T_DEMO" },
  "channel": { "id": "C_DEMO" },
  "user": { "id": "U_DEMO" },
  "message": {
    "user": "U_REQUESTER",
    "text": "Please follow up with customer by Friday.",
    "ts": "1700000000.000300",
    "permalink": "https://example.slack.com/archives/C_DEMO/p1700000000000300"
  }
}
```

OwnerOps creates a canonical task with:

- `sourceType: "slack_message"`
- `sourceReference` built from Slack team, channel, and message timestamp.
- `sourceUrl` copied from the Slack permalink when provided.
- `requestedBy` set to the Slack message author.
- `createdBy` set to the Slack user who triggered the shortcut.

Duplicate protection uses both the Slack action idempotency key and the canonical task source reference.

Reference: https://docs.slack.dev/reference/interaction-payloads/shortcuts-interaction-payload

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

Slack may retry requests. OwnerOps stores processed Slack action keys so a retried action receives an ephemeral already-handled response instead of applying the same status update or task creation twice.

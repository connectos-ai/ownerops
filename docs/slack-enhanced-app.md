# Slack Enhanced App

OwnerOps Enhanced Mode adds a Slack app service on top of the standalone task engine. Slack is an operating surface, not the canonical database. The canonical task remains in OwnerOps storage, and Slack interactions update that task through public application services.

## Current Implemented Slice

The current public candidate implements:

- `POST /slack/events` with Slack request signature verification.
- Slack URL verification challenge response.
- `POST /slack/interactions` with Slack request signature verification.
- `POST /slack/commands` with Slack request signature verification.
- OAuth install start and callback routes.
- Encrypted Slack installation token storage.
- Signed uninstall and token-revoked event handling.
- Message shortcut handling for `ownerops_turn_message_into_task`.
- Slash command task creation with `/ownerops task <task title>`.
- Modal submission task creation with `view.callback_id: "ownerops_task_create"`.
- Block Kit action handling for `ownerops_task_status`.
- Idempotency for retried Slack actions.
- Optional Slack team-to-OwnerOps workspace scoping using `workspace.policies.slackTeamId`.

The current slice does not yet implement App Home, opening modals through Slack Web API, or outgoing Slack API calls.

## OAuth Installation

OAuth start route:

```text
GET /slack/oauth/start?workspaceId=workspace_demo
```

The route returns a Slack authorization URL containing signed state. The state binds the install attempt to the OwnerOps workspace and redirect URI, expires after ten minutes, and is verified before OwnerOps exchanges Slack's temporary code.

OAuth callback route:

```text
GET /slack/oauth/callback?code=:code&state=:state
```

OwnerOps exchanges the code with Slack's `oauth.v2.access` method, stores only encrypted token records, and returns non-secret installation metadata. If the authorize URL includes `redirect_uri`, Slack requires the same redirect URI in the access-token exchange.

Required environment:

```text
OWNEROPS_SLACK_CLIENT_ID
OWNEROPS_SLACK_CLIENT_SECRET
OWNEROPS_SLACK_REDIRECT_URI
OWNEROPS_SLACK_OAUTH_STATE_SECRET
OWNEROPS_TOKEN_ENCRYPTION_KEY
```

The Events API handler processes signed `app_uninstalled` and `tokens_revoked` events by marking the Slack installation revoked and removing stored encrypted token material.

References:

- https://docs.slack.dev/authentication/installing-with-oauth
- https://docs.slack.dev/reference/methods/oauth.v2.access
- https://docs.slack.dev/reference/events/app_uninstalled

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

## Slash Command: Create Task

The implemented slash command creates a task directly from command text:

```text
/ownerops task Prepare weekly checklist
```

OwnerOps maps the Slack `team_id` to an OwnerOps workspace using `workspace.policies.slackTeamId`, then creates a canonical task with:

- `sourceType: "slack_command"`
- `sourceReference` built from Slack team, channel, user, command, and command text.
- `createdBy` and `requestedBy` set to the Slack user who ran the command.
- `status: "INBOX"`

Reference: https://docs.slack.dev/interactivity/implementing-slash-commands

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

## Modal Task Submission

The implemented modal submission handler listens for `view_submission` payloads with `view.callback_id: "ownerops_task_create"`.

OwnerOps reads submitted values from `view.state.values`. It looks for block IDs or action IDs containing:

- `title` for the required task title.
- `description` for optional details.
- `dueDate` for an optional Slack date picker value.
- `priority` for an optional selected option value such as `HIGH`.

OwnerOps creates canonical task data with:

- `sourceType: "slack_modal"`
- `sourceReference` built from Slack team, view ID, and view hash.
- `createdBy` and `requestedBy` set to the submitting Slack user.
- `dueAt` normalized by the core task model.

The response uses `response_action: "clear"` after a successful or duplicate submission so Slack can close the modal. Validation errors can return Slack modal error responses in a later slice.

Reference: https://docs.slack.dev/reference/interaction-payloads/view-interactions-payload/

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

When a workspace has `policies.slackTeamId`, Slack interaction payloads must come from the same Slack team ID. This is a first guardrail, not a complete authorization system. Full release still requires role checks and audit events for sensitive actions.

## Retry Handling

Slack may retry requests. OwnerOps stores processed Slack action keys so a retried action receives an ephemeral already-handled response instead of applying the same status update or task creation twice.

# Permissions And Scopes

OwnerOps should request the least Slack permissions needed for installed mode.

## Current Public Candidate

The current implemented Slack slice verifies signed requests, supports OAuth installation, stores Slack installation tokens encrypted at rest, handles uninstall and token-revoked events, handles one message shortcut, handles slash commands, opens the task creation modal, handles one modal submission, sends Slack messages, and handles one status action.

The default example bot scopes are:

- `commands` for slash commands.
- `chat:write` for posting OwnerOps confirmations and future reminders or briefs.
- `channels:read` and `groups:read` for future channel selection and task context.
- `channels:history` and `groups:history` for authorized message-to-task and triage context.
- `users:read` for Slack user mapping.

Deployments should remove scopes they do not actively use. Do not request history scopes merely because they are convenient.

## Future Enhanced Slack App Scopes

Exact scopes must be finalized against Slack API implementation before release. Likely categories:

- Commands for slash-command entrypoints.
- Interactivity for buttons, selects, shortcuts, and modals.
- Message shortcut support for turning Slack messages into OwnerOps tasks.
- Chat posting only when OwnerOps needs to send task confirmations, reminders, or briefs.
- Channel/history scopes only where needed and authorized.

Do not add broad workspace scopes by default. Every scope should document why it is needed, what data it can access, and whether there is a manual Slack-native fallback.

## Token Handling

Slack access tokens must never be committed, logged, or stored plaintext. OwnerOps stores encrypted token records using `OWNEROPS_TOKEN_ENCRYPTION_KEY`. Signed `app_uninstalled` and `tokens_revoked` Events API payloads mark an installation revoked and remove stored encrypted token material.

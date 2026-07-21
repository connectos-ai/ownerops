# Permissions And Scopes

OwnerOps should request the least Slack permissions needed for the installed mode.

## Current Public Candidate

The current implemented Slack slice verifies signed requests, handles one message shortcut, and handles one status action. It does not yet call Slack Web API methods, so it does not yet require bot-token scopes for the tested local slice.

## Future Enhanced Slack App Scopes

Exact scopes must be finalized against Slack API implementation before release. Likely categories:

- Commands for slash-command entrypoints.
- Interactivity for buttons, selects, shortcuts, and modals.
- Message shortcut support for turning a Slack message into an OwnerOps task.
- Chat posting only when OwnerOps needs to send task confirmations, reminders, or briefs.
- Channel/history scopes only where needed and authorized.

Do not add broad workspace scopes by default. Do not request history scopes merely because they are convenient. Every scope should be documented with why it is needed, what data it can access, and whether there is a manual Slack-native fallback.

## Token Handling Requirement

Slack access tokens must never be committed, logged, or stored plaintext. Production storage must encrypt tokens at rest and support token revocation and workspace uninstall handling before release gate `PASS`.

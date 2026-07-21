# Email Triage

OwnerOps email triage is designed to find work hiding in communication. It does not modify a mailbox by default.

## Default Behavior

OwnerOps may:

- Read authorized email metadata and content.
- Classify the message.
- Summarize the message.
- Recommend a next action.
- Draft a reply.
- Suggest a task.

OwnerOps must not send, delete, archive, label, or otherwise mutate a mailbox unless the workspace explicitly configures and authorizes that behavior.

## Categories

- Needs owner decision
- Needs owner reply
- Delegate
- Convert to task
- Schedule
- Waiting or follow-up
- Reference only
- Newsletter or low priority
- Spam or ignore

## Captured Fields

- Sender
- Subject
- Received time
- Thread context
- Short summary
- Requested action
- Implied deadline
- Suggested owner
- Priority
- Confidence
- Whether owner is uniquely required
- Recommended next action
- Draft response when useful
- Source reference
- Attachment metadata without unnecessary attachment storage

## Provider Model

Email integrations are adapters. Direct Gmail, Microsoft Graph, secure IMAP, mock email, and future ConnectOS email providers can all implement the same `EmailSource` capability.

ConnectOS is optional. OwnerOps must keep working with direct and mock providers when ConnectOS is unavailable.

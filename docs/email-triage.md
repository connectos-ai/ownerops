# Email Triage

OwnerOps email triage is designed to find work hiding in communication. It does
not modify a mailbox by default.

## Default Behavior

OwnerOps may:

- Read authorized email metadata and content.
- Classify messages.
- Summarize messages.
- Recommend next actions.
- Draft replies.
- Suggest tasks.

OwnerOps must not send, delete, archive, label, or otherwise mutate a mailbox
unless the workspace explicitly configures and authorizes that behavior.

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
- Explanation metadata
- Attachment metadata without unnecessary attachment storage

## Deterministic Explanation Metadata

The public triage engine is deterministic by default. It records why a message
became a task suggestion so a human reviewer can accept, reject, or adjust it
before work enters the task system.

Current suggestion explanations include:

- Source type, message identifier, and received timestamp.
- Evidence excerpt from the message.
- Matched work signals.
- Inferred requested outcome.
- Default owner and reason.
- Inferred due date and reason.
- Priority and reason.
- Owner-decision flag and reason.
- Uncertainties such as unclear due date or unclear smallest next action.

Current due-date inference supports `today`, `tomorrow`, and `by <weekday>`
language relative to the message received timestamp. Inferred dates are stored
on the suggested task as `dueAt`. If no explicit due-date language is found,
OwnerOps leaves `dueAt` empty and records that uncertainty for review.

## Provider Model

Email integrations are adapters. Direct Gmail, Microsoft Graph, secure IMAP,
mock email, and future ConnectOS email providers can all implement the same
`EmailSource` capability.

ConnectOS is optional. OwnerOps must keep working with direct and mock providers
when ConnectOS is unavailable.

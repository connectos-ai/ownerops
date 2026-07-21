# Slack Paid Enhancements

Paid Slack workspaces can use Slack Lists, Workflow Builder, and standalone canvases to make OwnerOps more structured while still keeping OwnerOps independent.

## Slack Lists

Recommended fields:

- Task
- Status
- Owner
- Priority
- Due date
- Project
- Source
- Next action
- Owner decision required
- Waiting on
- Last updated

Recommended views:

- Kanban by status
- Today
- Overdue
- By owner
- Waiting
- Needs owner
- High priority
- Completed this week

## Workflow Builder

Recommended workflows:

- Submit task
- Request owner decision
- Report blocker
- Weekly check-in
- New project intake
- Meeting action-item intake

Each workflow should define:

- Trigger
- Questions
- Validation
- Destination
- Expected output
- Required Slack plan
- Manual fallback

## Canvases

Recommended canvases:

- Team operating canvas
- Daily focus canvas
- Project canvas
- Meeting action-items canvas
- Onboarding canvas

## API Caution

Do not assume Slack Lists or Canvas manual features always imply mature programmatic API support for every operation. OwnerOps should document manual templates first and add API support only where official Slack APIs, scopes, and plan behavior are verified.

# Slack Paid Enhancements

Paid Slack workspaces can use Slack Lists, Workflow Builder, and standalone canvases to make OwnerOps more structured while still keeping OwnerOps independent.

Verified against official Slack documentation on 2026-07-22.

References:

- https://slack.com/help/articles/115003205446-Slack-plans-and-features
- https://slack.com/help/articles/27452748828179-Use-lists-in-Slack
- https://slack.com/help/articles/28932867593875-Manage-list-settings-in-Slack
- https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder
- https://slack.com/help/articles/17542172840595-Build-a-workflow--Create-a-workflow-in-Slack
- https://slack.com/help/articles/360035822734-Manage-Workflow-Builder-access-and-features
- https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack
- https://slack.com/help/articles/33536064287891-Manage-canvas-settings-in-Slack

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

## Canvas Uses

- Daily focus canvas
- Project canvas
- Meeting action-items canvas
- Onboarding canvas

## API Caution

Do not assume Slack Lists or Canvas manual features always imply mature programmatic API support for every operation. OwnerOps should document manual templates first and add API support only where official Slack APIs, scopes, and plan behavior are verified.

## Admin Caution

Paid-plan availability does not guarantee every member can use every feature. Workspace owners and admins can restrict access to Lists, Workflow Builder, canvas sharing, and workflow creation. Keep every paid workflow paired with a manual Slack message fallback.

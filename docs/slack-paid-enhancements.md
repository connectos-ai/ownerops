# Slack Plan-Aware Enhancements

Slack Lists, Workflow Builder, standalone canvases, and project templates can
make OwnerOps more structured while keeping OwnerOps independent. Availability
depends on Slack plan, workspace rollout, and admin settings, so every enhanced
workflow should keep a manual message-based fallback.

Verification date: 2026-07-22.

Official references reviewed:

- Slack plans and features: https://slack.com/help/articles/115003205446-Slack-plans-and-features
- Use lists in Slack: https://slack.com/help/articles/27452748828179-Use-lists-in-Slack
- Manage list settings: https://slack.com/help/articles/28932867593875-Manage-list-settings-in-Slack
- Workflow Builder guide: https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder
- Create a workflow: https://slack.com/help/articles/17542172840595-Build-a-workflow--Create-a-workflow-in-Slack
- Manage Workflow Builder access: https://slack.com/help/articles/360035822734-Manage-Workflow-Builder-access-and-features
- List automations: https://slack.com/help/articles/37752114318227-Set-up-automations-for-lists-in-Slack
- Project templates: https://slack.com/help/articles/34212044620947-Slack-templates--Manage-a-project

## Slack Lists

Use Lists when they are enabled in the target workspace and the team wants a
native table or board view.

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
- Completed week

Fallback: use the Slack Free task message template in
`templates/slack-free/task-message-template.md`.

## Workflow Builder

Use Workflow Builder when the workspace plan and admin settings allow the team
to create and publish workflows.

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
- Required Slack plan and workspace permission
- Manual fallback

Fallback: post the task message template into `#ownerops-inbox` and update the
status reaction/thread manually.

## Canvases And Templates

Use canvases and project templates for operating guides and lightweight shared
views, not as the sole canonical task database.

Useful canvases:

- Team operating canvas
- Daily focus canvas
- Project canvas
- Meeting action-items canvas
- Onboarding canvas

Slack's project starter template combines a project overview canvas, task
tracker list, and workflows. OwnerOps docs can mirror that pattern manually, but
the canonical OwnerOps database remains the durable system of record in Enhanced
Mode.

## API Caution

Do not assume a manual Slack feature implies mature programmatic API support.
OwnerOps should document manual templates first and add API support only where
official Slack APIs, scopes, rate limits, plan behavior, and admin settings have
been verified for the specific implementation.

## Admin Caution

Workspace owners and admins can restrict Lists, Workflow Builder, workflow
steps/triggers, canvas sharing, app installation, and app scopes. Plan-level
availability does not guarantee every member can use every feature.

Keep every enhanced workflow paired with a manual Slack message fallback.

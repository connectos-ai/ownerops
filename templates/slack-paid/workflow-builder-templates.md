# Workflow Builder Templates

Use these templates when Workflow Builder is enabled for the target workspace
and the team has permission to create/publish workflows. Keep the manual
fallbacks in place for workspaces where workflow creation, triggers, or steps
are restricted.

## Submit Task

- Trigger: workflow link or channel shortcut
- Questions: task, outcome, owner, due date, priority, source
- Destination: Slack List item or `#ownerops-inbox`
- Manual fallback: paste Slack Free task template

## Request Owner Decision

- Trigger: workflow link or message shortcut
- Questions: decision needed, options, recommendation, risk, deadline
- Destination: `#ownerops-decisions` or Slack List item with status `Needs Owner`
- Manual fallback: post task status `Needs Owner`

## Report Blocker

- Trigger: workflow link
- Questions: task, blocker, who can unblock, by when, attempted next step
- Destination: task thread, Slack List item update, or `#ownerops-waiting`
- Manual fallback: add `:warning:` thread update

## Weekly Check-In

- Trigger: scheduled workflow
- Questions: completed, carried forward, blockers, priorities, decisions needed
- Destination: weekly review canvas or team channel
- Manual fallback: copy weekly review template

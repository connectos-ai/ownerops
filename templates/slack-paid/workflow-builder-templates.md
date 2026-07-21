# Workflow Builder Templates

These workflows are native Slack patterns for paid workspaces.

## Submit Task

- Trigger: workflow link or channel shortcut
- Questions: task, outcome, owner, due date, priority, source
- Destination: Slack List item or `#ownerops-inbox`
- Manual fallback: paste the Slack Free task template

## Request Owner Decision

- Trigger: workflow link or message shortcut
- Questions: decision needed, options, recommendation, risk, deadline
- Destination: `#ownerops-decisions` or Slack List item with `Needs Owner`
- Manual fallback: post a task with status `Needs Owner`

## Report Blocker

- Trigger: workflow link
- Questions: task, blocker, who can unblock, by when, attempted next step
- Destination: task thread, Slack List item update, or `#ownerops-waiting`
- Manual fallback: add `:warning:` and a thread update

## Weekly Check-In

- Trigger: scheduled workflow
- Questions: completed, carried forward, blockers, priorities, decisions needed
- Destination: weekly review canvas or team channel
- Manual fallback: copy the weekly review template

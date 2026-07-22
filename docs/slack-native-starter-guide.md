# Slack-Native Starter Guide

This guide lets a team use OwnerOps conventions in Slack without installing the
OwnerOps app.

## Best For

- Free Slack workspaces.
- Small teams that need a simple operating rhythm.
- Teams that want to try OwnerOps before connecting integrations.

## Verified Slack Free Boundaries

Official Slack documentation reviewed on 2026-07-22 says Free workspaces are
limited to the most recent 90 days of visible message and file history, data
older than one year may be deleted, and Free workspaces have a 10 app
integration limit.

OwnerOps Free starter mode intentionally does not require Slack Lists, Workflow
Builder, or standalone canvases. Some Slack features and workspace settings may
be exposed differently by plan, admin setting, or rollout, so treat Lists,
Workflow Builder, and standalone canvases as optional workspace-specific
enhancements rather than the Free starter baseline.

Slack Free mode should be treated as an operating surface, not a durable
database. Keep the important task record in the task message, thread,
channel/DM canvas, and any external archive the team controls.

References:

- https://slack.com/help/articles/115003205446-Slack-plans-and-features
- https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack
- https://slack.com/help/articles/27452748828179-Use-lists-in-Slack
- https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder

## Recommended Channels

Start small:

- `#ownerops-inbox`: new tasks and requests.
- `#ownerops-today`: today's focus.
- `#ownerops-decisions`: owner-only decisions.
- `#ownerops-done`: completed work log.

Add project-specific channels only when needed.

## Task Message

```text
TASK: [Clear action-oriented title]

OUTCOME:
[What must be true when this is complete?]

OWNER:
[@person or Unassigned]

DUE:
[Date/time or No deadline]

PRIORITY:
[Critical / High / Normal / Low]

SOURCE:
[Link to original Slack message, email reference, or request]

STATUS:
[Inbox / Ready / In Progress / Waiting / Blocked / Needs Owner / Done]

NEXT ACTION:
[The next visible action]
```

## Status Reactions

Use one source-of-truth status reaction per task:

- `:eyes:` acknowledged
- `:raising_hand:` claimed
- `:large_blue_circle:` in progress
- `:pause_button:` waiting
- `:warning:` blocked
- `:crown:` owner decision
- `:white_check_mark:` completed
- `:no_entry_sign:` cancelled

## Thread Rules

- Keep task updates in the task message thread.
- Ask clarifying questions in the thread.
- Add links, evidence, and status notes in the thread.
- When status changes, update the status reaction and add a short thread note.

## Daily Review

Each morning:

1. Review `#ownerops-inbox`.
2. Move today's items into `#ownerops-today` or link them from the channel canvas.
3. Confirm each task has one owner.
4. Move true owner decisions into `#ownerops-decisions`.
5. Mark blocked and waiting items clearly.

## Weekly Review

Each week:

1. Review completed work.
2. Carry forward unfinished work.
3. Identify repeated blockers.
4. Find tasks with no owner.
5. Find owner decisions still waiting.
6. Decide what should be delegated next week.

## Known Free Plan Limits

- Message and file history are limited to the most recent 90 days.
- Older Free workspace data may be deleted under Slack's Free plan policy.
- Free workspaces have a 10 app integration limit.
- Lists, Workflow Builder, and standalone canvas availability should be verified
  in the target workspace; this starter guide does not rely on them.
- Channel/DM canvases can help organize the operating rhythm, but this guide
  avoids relying on canvas automation or canvas-as-database behavior.

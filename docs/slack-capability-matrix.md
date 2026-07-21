# Slack Capability Matrix

OwnerOps supports Slack without pretending every Slack workspace has the same features.

| Capability | Slack Free | Slack Paid | OwnerOps Enhanced App |
| --- | --- | --- | --- |
| Channels and messages | Yes | Yes | Yes |
| Threads | Yes | Yes | Yes |
| Reactions | Yes | Yes | Yes |
| Pins/bookmarks | Yes, subject to workspace features | Yes | Yes |
| Search | 90-day message/file history | Full history per plan | OwnerOps can preserve canonical history |
| Channel/DM canvases | Yes | Yes | Optional links/summaries |
| Standalone canvases | No | Yes | Optional |
| Slack Lists | No | Yes | Optional mapping |
| Workflow Builder | No | Yes | Optional workflow-triggered intake |
| Slack app commands/interactions | Up to Free app limits | Yes | Yes |
| OwnerOps canonical task database | No | No | Yes |
| Automated email triage | No | No | Yes |

References:

- https://slack.com/help/articles/115003205446-Slack-plans-and-features
- https://slack.com/features/canvas
- https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack
- https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder
- https://slack.com/features/workflow-automation

## Design Guidance

Use Slack Free mode for a lightweight native operating rhythm. Use Slack Paid mode when the workspace already has Lists and Workflow Builder. Use OwnerOps Enhanced mode when tasks need durable state, email triage, automation, reminders, reports, or integrations.

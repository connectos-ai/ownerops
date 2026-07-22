# Slack Capability Matrix

OwnerOps supports Slack without pretending every Slack workspace has the same features.

Verified against official Slack documentation on 2026-07-22.

| Capability | Slack Free | Slack Paid | OwnerOps Enhanced App |
| --- | --- | --- | --- |
| Channels and messages | Yes | Yes | Yes |
| Threads | Yes | Yes | Yes |
| Reactions | Yes | Yes | Yes |
| Pins and bookmarks | Yes, subject to workspace features | Yes | Yes |
| Search and history | Most recent 90 days of message and file history visible; older data may be deleted under Free policy | Full history per paid plan and retention settings | OwnerOps can preserve canonical task history outside Slack |
| Channel and DM canvases | One canvas for each channel or DM | Yes | Optional links and summaries |
| Standalone canvases | No | Yes | Optional |
| Slack Lists | No | Yes, if admins have not disabled or restricted them | Optional mapping |
| Workflow Builder | No | Yes, if admins have not restricted access | Optional workflow-triggered intake |
| Slack app commands and interactions | Possible, but Free workspaces are limited to 10 app integrations and approvals may apply | Yes, subject to workspace approvals | Yes |
| OwnerOps canonical task database | No | No | Yes |
| Automated email triage | No | No | Yes |

References:

- https://slack.com/help/articles/115003205446-Slack-plans-and-features
- https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack
- https://slack.com/help/articles/33536064287891-Manage-canvas-settings-in-Slack
- https://slack.com/help/articles/21290478840979-Feature-change-notice--Channel-canvases
- https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack
- https://slack.com/help/articles/27452748828179-Use-lists-in-Slack
- https://slack.com/help/articles/28932867593875-Manage-list-settings-in-Slack
- https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder
- https://slack.com/help/articles/17542172840595-Build-a-workflow--Create-a-workflow-in-Slack
- https://slack.com/help/articles/360035822734-Manage-Workflow-Builder-access-and-features
- https://slack.com/features/workflow-automation

## Design Guidance

Use Slack Free mode for a lightweight native operating rhythm. Use Slack Paid mode when the workspace already has Lists and Workflow Builder. Use OwnerOps Enhanced mode when tasks need durable state, email triage, automation, reminders, reports, and integrations.

Do not use Slack Free as the canonical archive for long-lived operating history. On Free, keep the durable task record in OwnerOps or export important summaries into a system the team controls.

Do not assume a paid workspace means every member can create lists or workflows. Owners and admins can restrict those features, so the starter templates should always have a manual channel-message fallback.

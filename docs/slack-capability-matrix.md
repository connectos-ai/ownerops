# Slack Capability Matrix

OwnerOps supports Slack without pretending every Slack workspace has the same
features, settings, retention policy, or admin permissions.

Verification date: 2026-07-22.

Official references reviewed:

- Slack plans and features: https://slack.com/help/articles/115003205446-Slack-plans-and-features
- Free plan limitations: https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack
- Use lists in Slack: https://slack.com/help/articles/27452748828179-Use-lists-in-Slack
- Manage list settings: https://slack.com/help/articles/28932867593875-Manage-list-settings-in-Slack
- Workflow Builder guide: https://slack.com/help/articles/360035692513-Guide-to-Slack-Workflow-Builder
- Manage Workflow Builder access: https://slack.com/help/articles/360035822734-Manage-Workflow-Builder-access-and-features
- Slack project templates: https://slack.com/help/articles/34212044620947-Slack-templates--Manage-a-project
- Slack Events API: https://docs.slack.dev/apis/events-api/
- Slash commands: https://docs.slack.dev/interactivity/implementing-slash-commands/

## OwnerOps Support Matrix

| Capability | Slack Free starter mode | Slack plan-aware native mode | OwnerOps Enhanced App |
| --- | --- | --- | --- |
| Channels and messages | Supported | Supported | Supported |
| Threads | Supported | Supported | Supported |
| Reactions | Supported | Supported | Supported |
| Pins/bookmarks | Supported where workspace UI allows | Supported where workspace UI allows | Can link to canonical tasks |
| Search and message/file history | Limited by Slack Free retention and visible-history policy | Governed by plan and workspace retention settings | OwnerOps stores canonical task history outside Slack |
| Channel and DM canvases | Usable as manual operating surfaces | Usable as manual operating surfaces | Can link/summarize, but not treat canvas as database |
| Standalone canvases | Verify in workspace | Stronger fit where enabled | Optional links/summaries |
| Slack Lists | Not required for Free starter workflow; verify workspace access before use | Recommended native task surface when enabled | Optional mapping only after official API/settings are verified |
| Workflow Builder | Not required for Free starter workflow; verify workspace access before use | Recommended for intake/check-in workflows when admins allow | Optional trigger path; not required for core task engine |
| Slack app commands/interactions | Possible if app installation limits and admin approvals allow | Supported subject to workspace approvals | Implemented enhanced mode |
| OwnerOps canonical task database | Not provided by Slack-native manual mode | Not provided by Slack-native manual mode | Provided by OwnerOps |
| Automated email triage | Not provided by Slack-native manual mode | Not provided by Slack-native manual mode | Provided by OwnerOps |

## Conservative Product Rule

Slack Free starter mode must remain useful with only channels, messages,
threads, reactions, manual task templates, and a channel/DM canvas. OwnerOps does
not require Slack Lists or Workflow Builder on Free because feature availability,
admin settings, and workspace limits can vary.

Plan-aware Slack enhancements may use Lists, Workflow Builder, standalone
canvases, and Slack project templates, but every guide should keep a manual
message-based fallback.

Do not assume a manual Slack feature implies reliable programmatic API support.
OwnerOps should add Slack API automation only after the relevant official Slack
API, scopes, rate limits, plan behavior, and admin settings are verified for the
specific implementation.

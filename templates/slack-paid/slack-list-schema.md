# Slack List Schema

Use this schema when setting up a Slack List for OwnerOps.

| Field | Type | Notes |
| --- | --- | --- |
| Task | Text | Clear action title |
| Status | Select | Inbox, Ready, In Progress, Waiting, Blocked, Needs Owner, Done |
| Owner | Person | One accountable owner |
| Priority | Select | Critical, High, Normal, Low |
| Due date | Date | Optional |
| Project | Text or select | Optional |
| Source | URL or text | Link to original message or OwnerOps source |
| Next action | Text | The next visible action |
| Owner decision required | Checkbox | True only when owner is uniquely required |
| Waiting on | Person or text | Who or what is blocking progress |
| Last updated | Date | Maintained manually or by workflow |

Recommended views:

- Kanban by Status
- Today
- Overdue
- By Owner
- Waiting
- Needs Owner
- Completed This Week

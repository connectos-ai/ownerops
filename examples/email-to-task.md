# Email To Task Example

All names, addresses, subjects, and task IDs are fictional.

## Source Email

```text
From: Jordan Demo
To: Operations Team
Subject: Updated walkthrough packet
Received: 2026-01-05T14:30:00.000Z

Could you send the updated walkthrough packet by Thursday? Please include the
new checklist and confirm who will be onsite.
```

## Triage Result

```json
{
  "sourceType": "email",
  "sourceReference": "email_demo_walkthrough_001",
  "containsWork": true,
  "requestedOutcome": "Updated walkthrough packet sent with checklist and onsite owner confirmed.",
  "suggestedOwnerId": "user_riley",
  "priority": "NORMAL",
  "dueAt": "2026-01-08T17:00:00.000Z",
  "confidence": 0.91,
  "ownerDecisionRequired": false,
  "nextAction": "Draft and send updated walkthrough packet."
}
```

## Approved Task

```text
TASK: Send updated walkthrough packet
OUTCOME: Packet includes new checklist and onsite owner confirmation.
OWNER: Riley
DUE: 2026-01-08
PRIORITY: Normal
SOURCE: email_demo_walkthrough_001
STATUS: Ready
NEXT ACTION: Draft packet and confirm onsite owner.
```

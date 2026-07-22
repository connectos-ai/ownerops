## Summary

Describe the change and why it belongs in OwnerOps.

## Scope

- [ ] Standalone task manager
- [ ] Slack-native templates or docs
- [ ] Enhanced Slack app
- [ ] Email triage
- [ ] Briefs or reviews
- [ ] Storage, backup, restore, or migrations
- [ ] Security, privacy, or release gates
- [ ] Documentation only

## Safety

- [ ] No secrets, tokens, credentials, real workspace data, real email content, or private customer data.
- [ ] No required dependency on DoBoth, ConnectOS, Slack, email, or an AI provider.
- [ ] Integrations remain optional and behind documented adapters.
- [ ] Public examples are fictional.

## Verification

Run the relevant checks before requesting review:

```bash
npm run check
npm test
npm run ci
bash scripts/public-release-audit.sh .
```

List what passed:

-

## Notes For Maintainers

Mention any migration, backup/restore, security, or compatibility concerns.

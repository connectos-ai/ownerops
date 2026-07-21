# Contributing

Thank you for helping improve OwnerOps.

## Ground Rules

- Keep OwnerOps useful as a standalone product.
- Do not add a required dependency on DoBoth, ConnectOS, Slack, email, or an AI provider.
- Keep integrations behind documented adapters.
- Do not commit secrets, private data, real customer data, or private workspace details.
- Add tests for behavior changes.
- Update docs when public behavior changes.

## Development Flow

1. Fork or branch from `main`.
2. Make one focused change.
3. Run tests and security checks.
4. Open a pull request with a clear summary and verification notes.

## Public Safety

Before submitting:

```sh
bash scripts/public-release-audit.sh .
```

If the audit reports `FAIL`, do not submit the change until findings are resolved.

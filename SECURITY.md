# Security Policy

OwnerOps handles operational work, messages, tasks, and optional credentials. Treat all user content and integration data as sensitive.

## Reporting A Vulnerability

Please report security issues privately through GitHub Security Advisories when available. Do not open a public issue containing secrets, exploit details, private data, or live workspace information.

## Security Principles

- No secrets in git.
- No real customer data in examples.
- Workspace-scoped authorization for all data access.
- Signed Slack requests in enhanced Slack mode.
- OAuth state validation and replay protection.
- Token encryption at rest for production integrations.
- Privacy-conscious logging by default.
- AI output is advisory; authorization and policy checks decide actions.

## Supported Versions

OwnerOps is pre-1.0 until the public release gate passes. Security fixes should target `main` unless a release branch exists.

# Auth Policy

OwnerOps is standalone-first. Local development is open by default so a solo user can run the task manager without creating accounts, connecting Slack, or configuring external identity.

## HTTP API

Set `OWNEROPS_API_TOKEN` for any exposed self-hosted API deployment. When set, OwnerOps requires `Authorization: Bearer <token>` for:

- `/api/*`
- `/slack/oauth/start`

Use a long random value from a secret manager or deployment environment. Never commit it to git or publish it in examples.

## Slack Ingress

Slack inbound routes do not use `OWNEROPS_API_TOKEN` because Slack cannot send that header. They use Slack request signature verification:

- `/slack/events`
- `/slack/interactions`
- `/slack/commands`

Slack OAuth callback uses signed OAuth state because Slack redirects back to OwnerOps without custom bearer headers.

## Browser Access

The dependency-free static web app does not store bearer tokens. For production browser access, place OwnerOps behind private network access, a VPN, or reverse-proxy authentication. Keep the direct OwnerOps API off the public internet unless `OWNEROPS_API_TOKEN` and transport-level protections are configured.

## Workspace Boundary

Workspace IDs scope OwnerOps data, but they are not authentication secrets. Do not rely on unguessable workspace IDs for access control.

## Current Limits

This public candidate stores workspace user role/status metadata and external
identity mappings for assignment and future authorization policy. It does not
yet implement first-party user login, password storage, sessions, SSO, or full
role-based access control. Those can be added later behind the same public API
boundaries without making DoBoth or ConnectOS dependencies.

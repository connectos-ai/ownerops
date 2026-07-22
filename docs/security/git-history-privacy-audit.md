# Git History Privacy Audit

Date: 2026-07-22

Status: PASS current local public-release candidate history.

## Scope

Repository inspected: local public-release preparation checkout.

Latest product/security content checkpoint inspected before this evidence-only
audit update:

```text
c0f1fc3e22169b961ec7a0c078470b4e0a57ff5a
```

This audit file is committed as evidence after the scan. Verify the current
checkout with `git rev-parse HEAD` before publication.

Reachable history inspected:

```text
54 commits on main after this evidence update
```

Object database note:

- `git fsck --full --no-reflogs` reported three dangling local commits and dangling blobs.
- Dangling objects are not reachable from `main` and are not part of a normal push.
- Dangling commits use generic maintainer metadata and are unreachable from `main`.
- Dangling-object sensitive scans found no private/client identifiers, local machine paths, or high-risk token-shaped secret patterns.

## Commands Used

```bash
git status --short --branch
git remote -v
git rev-parse HEAD
git rev-list --all --count
git log --all --format='%H%x09%an%x09%ae%x09%cn%x09%ce' | sort -u
git log --all --format='%H %s%n%b'
git grep -n -I -i -E '<private-and-secret-denylist>' $(git rev-list --all)
git grep -n -I -E '<local-home-path-denylist>' $(git rev-list --all)
git fsck --full --no-reflogs
git cat-file -p '<dangling-object>' | grep -Eai '<private-and-secret-denylist>'
```

Historical content scans used `git grep` across every reachable commit for
private/client identifiers, local machine paths, common secret formats, and
token-shaped values. The exact private denylist is intentionally not published
in this public repository.

## Search Categories Used

Audit covered:

- Known private names and client identifiers from the source environment.
- Known private email account, church, property, message-source, and machine identifiers from the source environment.
- Local absolute path markers.
- Common cloud access key shapes.
- Common OAuth token shapes.
- Common Slack token shapes.
- Common OpenAI-compatible API key shapes.
- PEM and OpenSSH private-key block markers.
- Secret-adjacent terms such as API keys, client secrets, signing secrets,
  refresh tokens, access tokens, bot tokens, database URLs, passwords, bearer
  tokens, credentials, OAuth, Gmail, and Slack.

## Findings

- Current branch has no configured Git remote.
- Author/committer metadata is generic: `OwnerOps Maintainers <maintainers@example.com>`.
- Reachable history contains no matches for real private/client identifiers, local machine paths, or high-risk token-shaped secret patterns.
- Commit messages contain no private details.
- Historical filenames include expected public files such as `.env.example`, Slack docs, OAuth docs, backup scripts, Slack tests, and release-audit docs.
- Secret-adjacent matches in reachable history are expected public placeholders, environment variable names, example local database URLs, and code paths that read secrets from environment variables.
- No real `.env` files, backup artifacts, log files, runtime data, credential exports, Slack/Gmail tokens, private keys, or client data were found in reachable history.
- Dangling local objects are unreachable from `main`; sensitive scans found no private/client identifiers, local machine paths, or high-risk token-shaped secret patterns.

## Remediation

No remediation required for the reachable public history checkpoint.

Before publication, maintainers may run `git gc --prune=now` in the local
preparation clone to remove unreachable dangling objects. This is not required
for a normal push, but keeps the local object database tidy.

## Remaining Accepted Risks

- Authenticated GitHub repository inspection or creation is still pending.
- GitHub-hosted CI evidence is still pending.
- Final public-release security audit remains `FAIL` until GitHub gates are complete.

## Result

PASS for local reachable git history privacy evidence at the inspected
checkpoint. This is not the final public-release PASS.

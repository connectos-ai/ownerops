# Git History Privacy Audit

Date: 2026-07-21

Status: PASS for current local public-release candidate history.

## Scope

Repository inspected: local public-release preparation checkout.

Commit inspected:

```text
fe7373c07bef1d31110550e3034b4aaef2aa0c46
```

Reachable history inspected:

```text
24 commits on main
```

Object database note:

- `git fsck --full --no-reflogs` reported two dangling scaffold commits.
- Both dangling commits were inspected separately.
- The dangling commits are not reachable from `main` and are not part of normal push history.
- They used the same generic maintainer metadata and contained no real token-shaped secrets.
- Their only privacy-scan matches were the audit script's own denylist configuration.

## Commands Used

```bash
git status --short
git remote -v
git log --all --format='%H%x09%an%x09%ae%x09%cn%x09%ce' | sort -u
git log --all --name-only --format='' | sed '/^$/d' | sort -u
git log --all --name-status --format='commit %H %s'
git log --all --format='%H %s%n%b'
git count-objects -vH
git rev-list --all --count
git fsck --full --no-reflogs
git show --stat --oneline --decorate --summary 1e7818a18056b7855dace6a45f3388b09cad45ba
git show --stat --oneline --decorate --summary bbe4ca5a3dba12a60b592e266fdeb13aed5e535f
```

Historical content scans used `git grep` across every reachable commit for private/client identifiers, local machine paths, common secret formats, and token-shaped values.

## Search Categories Used

The exact private denylist is intentionally not published in this public repository. The audit covered:

- Known private names and client identifiers from the source environment.
- Known private email account, church, property, message-source, and machine identifiers from the source environment.
- Local absolute path markers.
- Common cloud access key shapes.
- Common OAuth token shapes.
- Common Slack token shapes.
- Common OpenAI-compatible API key shapes.
- PEM and OpenSSH private-key block markers.
- Secret-adjacent terms such as API keys, client secrets, signing secrets, refresh tokens, access tokens, bot tokens, database URLs, passwords, bearer tokens, credentials, OAuth, Gmail, and Slack.

## Findings

- Current branch has no configured Git remote.
- Author and committer metadata are generic: `OwnerOps Maintainers <maintainers@example.com>`.
- Reachable history contains no matches for real private/client identifiers, local machine paths, or high-risk token-shaped secret patterns.
- Historical filenames include expected public files such as `.env.example`, Slack docs, OAuth docs, backup scripts, and Slack tests.
- Secret-adjacent matches are expected public placeholders, environment variable names, example local database URLs, and source code that reads secrets from environment variables.
- No real `.env` files, backup artifacts, log files, runtime data, credential exports, Slack/Gmail tokens, private keys, or client data were found in reachable history.
- Clean-checkout verification passed from a separate local clone: `npm ci`, `npm run ci`, dependency audit, `/healthz`, and the standalone web shell.

## Remediation

No remediation required for reachable public history at this checkpoint.

Before publication, maintainers may run `git gc --prune=now` in the local preparation clone to remove unreachable dangling objects. This is not required for a normal push, but it keeps the local release-prep object database tidy before any archive or handoff.

## Remaining Release Risks

- GitHub-hosted CI evidence does not exist until the public repository exists and the branch is pushed.
- The final public-release security audit still reports `FAIL`.
- Some product checklist items remain incomplete.

## Result

PASS for git history, privacy, metadata, private remote, clean checkout, dependency audit, and local quickstart evidence at commit `fe7373c07bef1d31110550e3034b4aaef2aa0c46`.

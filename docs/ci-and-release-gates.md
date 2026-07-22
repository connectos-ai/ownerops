# CI And Release Gates

OwnerOps uses GitHub Actions for repeatable public-release checks. CI is
required before publishing the repository and before marking the public-release
security audit `PASS`.

## Local Gate

Run the same core checks locally:

```bash
npm ci
npm run ci
npm run release:local-gate
```

`npm run ci` runs:

- Syntax and shell checks.
- Public release audit script.
- Full test suite.
- High-severity dependency audit.

`npm run release:local-gate` refuses to pass with a dirty working tree,
non-`main` branch, or configured remotes, then runs local CI, whitespace checks,
and the public release audit.

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`.

`Quality Gate` job runs:

- `npm ci`
- `npm run check`
- `npm test`
- `npm audit --audit-level=high`

`Dependency Review` job runs on pull requests and fails on high-severity
dependency findings.

GitHub Actions are pinned to immutable commit SHAs with comments recording
source tags reviewed on 2026-07-22:

- `actions/checkout` from `v4`.
- `actions/setup-node` from `v4`.
- `actions/dependency-review-action` from `v4.7.4`.

Dependabot is configured for `github-actions` updates so maintainers can refresh
pinned SHAs deliberately rather than relying on floating major-version tags.

## Dependency Updates

`.github/dependabot.yml` checks npm dependencies and GitHub Actions weekly.
Keep updates small, review dependency changes for scope and maintainer health,
and run the local release gate before merging.

## Public Release Rule

CI passing is necessary but not sufficient for publication. The release gate
remains closed until:

- `docs/security/public-release-security-audit.md` says `PASS`.
- Working tree and git-history privacy scans pass.
- Author/committer metadata is reviewed.
- No private remotes are configured.
- Target GitHub repository is inspected or safely created.
- GitHub-hosted CI evidence is recorded.
- Branch protection recommendations are documented.

Do not push or publish OwnerOps until every release checklist item is complete.
See `docs/release-evidence-index.md` and `docs/github-launch-runbook.md`.

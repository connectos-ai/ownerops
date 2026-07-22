# CI And Release Gates

OwnerOps uses GitHub Actions for repeatable public-release checks. CI is required before publishing the repository and before marking the public-release security audit `PASS`.

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

`npm run release:local-gate` refuses to pass with a dirty working tree, a non-`main` branch, or configured remotes, then runs local CI, whitespace checks, and the public release audit.

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`.

The `Quality Gate` job runs:

- `npm ci`
- `npm run check`
- `npm test`
- `npm audit --audit-level=high`

The `Dependency Review` job runs on pull requests and fails on high-severity dependency findings.

## Public Release Rule

CI passing is necessary but not sufficient for publication. The release gate remains closed until:

- `docs/security/public-release-security-audit.md` says `PASS`.
- Working tree and git history privacy scans pass.
- Author and committer metadata are reviewed.
- No private remotes are configured.
- The target GitHub repository is inspected or safely created.
- GitHub-hosted CI evidence is recorded.
- Branch protection recommendations are documented.

Do not push or publish OwnerOps until every release checklist item is complete. See `docs/release-evidence-index.md` and `docs/github-launch-runbook.md`.

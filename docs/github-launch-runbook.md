# GitHub Launch Runbook

Date: 2026-07-29

Status: PUBLIC LAUNCH COMPLETE

OwnerOps is published at:

```text
https://github.com/connectos-ai/ownerops
```

Repository description:

```text
Open-source owner-operator triage Slack-native task system.
```

## Current GitHub State

- Owner: `connectos-ai`.
- Repository: `ownerops`.
- Visibility: public.
- Default branch: `main`.
- Remote: `https://github.com/connectos-ai/ownerops.git`.
- Latest launch checkpoint:
  `79e3fcfcef3c9f900a88eea723bfa1d568794da4`.
- GitHub-hosted CI passed:
  `https://github.com/connectos-ai/ownerops/actions/runs/30492679255`.
- Branch protection is not enabled on `main`; this matches the observed state of
  sibling repositories `connectos-ai/connectos` and `connectos-ai/scheduleos` on
  2026-07-29.

## Source Documents

- https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

## Pre-Publish Gate For Future Rebuilds

Before replacing, recreating, or republishing the repository, run the local gate
from a clone with no configured remotes:

```bash
npm run release:local-gate
```

That command verifies:

- Clean working tree.
- Branch is `main`.
- No configured remotes.
- Generic author/committer metadata.
- Clean install.
- Local CI.
- Public release audit.

After a public remote exists, use the equivalent local CI command for normal
maintenance:

```bash
npm run ci
bash scripts/public-release-audit.sh .
git diff --check
```

## Safe Publication Pattern

For a new public repository seeded from a local release candidate:

1. Confirm the target repository name and owner.
2. Confirm the target repository does not already contain legitimate history.
3. Create the GitHub repository without initializing README, `.gitignore`, or
   license files.
4. Add `origin` intentionally after inspection.
5. Push `main` without force.
6. Wait for GitHub-hosted CI.
7. Record hosted CI evidence.
8. Record branch protection state or configuration.
9. Run final privacy/security scans.
10. Change `docs/security/public-release-security-audit.md` to `PASS` only if
    zero critical or high-risk findings remain.

## Branch Protection Recommendation

Recommended settings for `main` when maintainers want stricter contribution
controls:

- Require pull request before merging.
- Require status checks before merging.
- Require the `Quality Gate` status check.
- Require branches to be up to date before merging when the maintainer workflow
  supports it.
- Require conversation resolution before merging.
- Do not allow force pushes.
- Do not allow deletions.
- Consider requiring signed commits if maintainers can support them
  consistently.
- Create or verify the `connectos-ai/maintainers` team before relying on
  CODEOWNERS-required reviews.

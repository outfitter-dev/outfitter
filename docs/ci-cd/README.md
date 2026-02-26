# CI/CD Documentation

This directory documents the continuous integration and deployment workflows for the Outfitter monorepo.

## Guides

- [Releases](../RELEASES.md) -- Version management, changesets, and npm publishing
- [Auto-Labeling](./auto-labeling.md) -- How PRs are automatically categorized
- [Turbo Cache](./turbo-cache.md) -- Self-hosted remote build cache setup
- [Stacked PR Workflow](./stacked-pr-workflow.md) -- Schema drift prevention and triage for stacked branches

## Quick Reference

### Release a Change

1. Open a PR with your changes
2. Run `bun changeset` to create a changeset describing the change
3. Commit the changeset file with your PR
4. Merge the PR -- a canary release publishes automatically to `@canary`
5. When ready for stable, run **Actions > Release > Run workflow** with `mode=stable`
6. Review and merge the release PR to publish `@latest`

### Stacked PR Pre-Submit

Before submitting a stacked branch via `gt submit` or `gt stack submit`:

```bash
bun run verify:stack
```

This regenerates the surface map, checks for uncommitted drift, and runs
pre-push verification. See [Stacked PR Workflow](./stacked-pr-workflow.md) for
the full playbook.

### Skip a Release

Add the `release:none` label to PRs that don't need a release (docs, CI, tests).

### Workflows Overview

| Workflow         | Trigger                                         | Purpose                                                              |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `auto-label.yml` | PR open/update                                  | Label PRs by file changes and release type                           |
| `release.yml`    | Push to main, manual dispatch, release PR merge | Unified release flow: canary publish, stable prepare, stable publish |
| `label-sync.yml` | Push to main                                    | Sync label definitions                                               |
| `ci.yml`         | PR/push                                         | Build and test                                                       |

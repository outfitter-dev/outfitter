# CI/CD Documentation

This directory documents the continuous integration and deployment workflows for the Outfitter monorepo.

## Guides

- [Releases](../RELEASES.md) -- Version management, changesets, and npm publishing
- [Auto-Labeling](./auto-labeling.md) -- How PRs are automatically categorized
- [Turbo Cache](./turbo-cache.md) -- Self-hosted remote build cache setup

## Quick Reference

### Release a Change

1. Open a PR with your changes
2. Run `bun changeset` to create a changeset describing the change
3. Commit the changeset file with your PR
4. Merge the PR -- a canary release publishes automatically to `@canary`
5. When ready for stable, run **Actions > Release > Run workflow**
6. Review and merge the release PR to publish `@latest`

### Skip a Release

Add the `release:none` label to PRs that don't need a release (docs, CI, tests).

### Workflows Overview

| Workflow                  | Trigger                            | Purpose                                                    |
| ------------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `auto-label.yml`          | PR open/update                     | Label PRs by file changes                                  |
| `canary.yml`              | Push to main (changeset files)     | Publish `@canary` dist-tag                                 |
| `changeset-labels.yml`    | PR with manual changeset           | Apply release label                                        |
| `release.yml`             | Manual dispatch / release PR merge | Two-phase: prepare release PR, then publish `@latest`      |
| `stack-labels.yml`        | PR open/update                     | Graphite stack labels                                      |
| `label-sync.yml`          | Push to main                       | Sync label definitions                                     |
| `ci.yml`                  | PR/push                            | Build and test                                             |
| `bun-stability-trial.yml` | Manual dispatch                    | Repeated `test:ci` runs across Bun versions with artifacts |

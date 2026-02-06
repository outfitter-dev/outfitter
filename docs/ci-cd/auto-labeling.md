# Auto-Labeling

This document describes how pull requests are automatically labeled in the Outfitter monorepo.

## Overview

PRs are automatically labeled based on the files they change. This powers several workflows:
- Release automation (which packages need version bumps)
- PR triage (what areas are affected)
- Review routing (who should review)

## How It Works

When a PR is opened or updated, the `auto-label.yml` workflow runs and applies labels based on file path patterns defined in `.github/labeler.yml`.

## Label Categories

### Package Labels

PRs touching package source code get `package/*` labels:

| Label | Triggered By |
|-------|--------------|
| `package/contracts` | `packages/contracts/**` |
| `package/types` | `packages/types/**` |
| `package/cli` | `packages/cli/**` |
| `package/config` | `packages/config/**` |
| `package/logging` | `packages/logging/**` |
| `package/file-ops` | `packages/file-ops/**` |
| `package/state` | `packages/state/**` |
| `package/index` | `packages/index/**` |
| `package/daemon` | `packages/daemon/**` |
| `package/mcp` | `packages/mcp/**` |
| `package/testing` | `packages/testing/**` |
| `package/tooling` | `packages/tooling/**` |
| `package/kit` | `packages/kit/**` |

These labels are used by the auto-changeset workflow to determine which packages need version bumps.

### Area Labels

PRs are labeled by the area of the codebase they affect:

| Label | Triggered By |
|-------|--------------|
| `area/outfitter` | `apps/outfitter/**` |
| `area/agents` | `packages/agents/**` |
| `area/plugins` | `plugins/**` |
| `area/ci-cd` | `.github/**` |
| `area/docs` | `docs/**`, `*.md` |
| `area/tooling` | `scripts/**`, config files |

### Type Labels

Some content types are auto-detected:

| Label | Triggered By |
|-------|--------------|
| `docs` | Documentation files (`.md`) |
| `tests` | Test files (`*.test.ts`, `__tests__/**`) |
| `deps` | Dependency files (`package.json`, `bun.lock`) |

### Graphite Stack Labels

PRs in Graphite stacks get position labels:

| Label | Meaning |
|-------|---------|
| `stack:base` | Bottom of a stack (merges directly to main) |
| `stack:middle` | Middle of a stack |
| `stack:top` | Top of a stack |

These are managed by `stack-labels.yml`.

## Configuration

Labels are defined in two places:

### `.github/labels.yml`

The source of truth for all labels. Defines name, color, and description. Synced to GitHub via `label-sync.yml` workflow.

```yaml
- name: package/cli
  color: "0366d6"
  description: "@outfitter/cli package"
```

### `.github/labeler.yml`

Maps file patterns to labels for the auto-labeler action.

```yaml
package/cli:
  - changed-files:
      - any-glob-to-any-file: packages/cli/**
```

## Adding New Labels

1. Add the label definition to `.github/labels.yml`
2. Add the file pattern mapping to `.github/labeler.yml`
3. The label syncs to GitHub when merged to main

## Manual Labels

Some labels are applied manually, not automatically:

### Release Labels

| Label | Purpose |
|-------|---------|
| `release:patch` | Bug fix release |
| `release:minor` | Feature release |
| `release:major` | Breaking change release |
| `release:none` | No release needed |

See [Releases](./releases.md) for details.

### Priority Labels

| Label | Purpose |
|-------|---------|
| `priority/critical` | Drop everything |
| `priority/high` | Address soon |
| `priority/medium` | Normal priority |
| `priority/low` | When time permits |

### Status Labels

| Label | Purpose |
|-------|---------|
| `status/blocked` | Waiting on something |
| `status/needs-info` | Needs clarification |
| `status/ready` | Ready for review |

## Workflows

| Workflow | Purpose |
|----------|---------|
| `auto-label.yml` | Apply labels based on file changes |
| `stack-labels.yml` | Apply Graphite stack position labels |
| `changeset-labels.yml` | Apply release labels from manual changesets |
| `label-sync.yml` | Sync label definitions to GitHub |

## Troubleshooting

### Labels not being applied

1. Check that the workflow ran (Actions tab)
2. Verify the file pattern in `.github/labeler.yml`
3. Ensure the label exists in `.github/labels.yml`

### Wrong labels applied

The labeler uses glob patterns. Check that your patterns aren't too broad or overlapping.

### Labels out of sync

If labels in GitHub don't match `labels.yml`, manually trigger the label-sync workflow or wait for the next push to main that changes `labels.yml`.

## Related Documentation

- [Releases](./releases.md) — How release labels drive publishing
- [GitHub Labeler Action](https://github.com/actions/labeler)

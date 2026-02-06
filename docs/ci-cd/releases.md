# Release Process

This document describes how releases work in the Outfitter monorepo.

## Overview

We use [Changesets](https://github.com/changesets/changesets) for version management and npm publishing. The process is automated via GitHub Actions—you don't need to run any commands locally.

## How It Works

```
PR with code changes
        ↓
Add release:minor label (or patch/major)
        ↓
PR merges to main
        ↓
auto-changeset.yml generates changeset file
        ↓
Changesets action opens "Version Packages" PR
        ↓
Merge Version PR
        ↓
Packages published to npm
```

## Release Labels

Add one of these labels to your PR to indicate the type of change:

| Label | When to Use | Version Bump |
|-------|-------------|--------------|
| `release:patch` | Bug fixes, minor improvements | `0.1.0` → `0.1.1` |
| `release:minor` | New features, non-breaking changes | `0.1.0` → `0.2.0` |
| `release:major` | Breaking changes | `0.1.0` → `1.0.0` |
| `release:none` | Docs, CI, internal changes (no release) | No change |

### Choosing the Right Label

**Use `release:patch` for:**
- Bug fixes
- Performance improvements
- Documentation fixes in code comments
- Dependency updates (non-breaking)

**Use `release:minor` for:**
- New features
- New exports or APIs
- Deprecations (without removal)
- Significant internal refactors

**Use `release:major` for:**
- Breaking API changes
- Removed exports or features
- Changed function signatures
- Minimum Node/Bun version bumps

**Use `release:none` for:**
- Documentation changes (docs/, README)
- CI/CD workflow changes
- Test-only changes
- Editor/tooling config

## Automatic Changeset Generation

When a PR with a `release:*` label merges to main:

1. The `auto-changeset.yml` workflow runs
2. It reads the release label to determine bump type
3. It reads `package/*` labels to determine affected packages
4. It generates a changeset file: `.changeset/pr-{number}-{timestamp}.md`
5. It commits the changeset to main

Example generated changeset:

```markdown
---
"@outfitter/cli": minor
"@outfitter/config": minor
---

feat(cli): add new command for workspace management

PR: https://github.com/outfitter-dev/outfitter/pull/123
```

## Version Packages PR

When changesets exist on main, the Changesets GitHub Action automatically:

1. Opens a "Version Packages" PR
2. Bumps versions in all affected `package.json` files
3. Updates `CHANGELOG.md` for each package
4. Consumes (deletes) the changeset files

This PR stays open and accumulates changes until you're ready to release.

## Publishing

When the "Version Packages" PR is merged:

1. The release workflow runs
2. All packages with version bumps are built
3. Tests run to verify everything works
4. Packages are published to npm with OIDC provenance

Published packages are available immediately:

```bash
npm install @outfitter/cli@latest
```

## Manual Changesets (Optional)

You can still create changesets manually if preferred:

```bash
bun changeset
```

This opens an interactive prompt to select packages and bump types. The generated changeset file should be committed with your PR.

Manual changesets are useful when:
- You want a custom changelog message
- You need to describe changes in detail
- You're making coordinated changes across many packages

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `auto-changeset.yml` | PR merge with release label | Generate changeset from PR |
| `changeset-labels.yml` | PR with `.changeset/*.md` | Apply release label from manual changeset |
| `release.yml` | Push to main | Create Version PR or publish |

## Troubleshooting

### PR merged but no changeset was created

Check that your PR had a `release:patch`, `release:minor`, or `release:major` label. The `release:none` label explicitly skips changeset generation.

### Version Packages PR not appearing

The Changesets action only creates a Version PR when changesets exist. Check that:
- Changesets were committed to main
- The release workflow ran successfully

### Wrong packages in changeset

The auto-changeset workflow uses `package/*` labels to determine affected packages. Ensure your PR was correctly labeled by the auto-labeler.

### Need to release immediately

If you need to release without waiting for more changes:
1. Merge the "Version Packages" PR
2. This triggers publishing immediately

## Related Documentation

- [Auto-Labeling](./auto-labeling.md) — How PRs get labeled automatically
- [Changesets Documentation](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)

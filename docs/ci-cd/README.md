# CI/CD Documentation

This directory documents the continuous integration and deployment workflows for the Outfitter monorepo.

## Guides

- [Releases](./releases.md) — Version management, changesets, and npm publishing
- [Auto-Labeling](./auto-labeling.md) — How PRs are automatically categorized
- [Turbo Cache](./turbo-cache.md) — Self-hosted remote build cache setup

## Quick Reference

### Release a Change

1. Open a PR with your changes
2. Wait for auto-labeling to detect affected packages
3. Add a release label: `release:patch`, `release:minor`, or `release:major`
4. Merge the PR
5. A changeset is auto-generated and committed to main
6. When ready, merge the "Version Packages" PR to publish

### Skip a Release

Add the `release:none` label to PRs that don't need a release (docs, CI, tests).

### Workflows Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `auto-label.yml` | PR open/update | Label PRs by file changes |
| `auto-changeset.yml` | PR merge with release label | Generate changeset |
| `changeset-labels.yml` | PR with manual changeset | Apply release label |
| `release.yml` | Push to main | Version PR or publish |
| `stack-labels.yml` | PR open/update | Graphite stack labels |
| `label-sync.yml` | Push to main | Sync label definitions |
| `ci.yml` | PR/push | Build and test |

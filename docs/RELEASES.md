# Releases

How packages get from your editor to npm. This document covers the release philosophy, workflows, and guardrails for the Outfitter monorepo.

## Why We Changed

The old process was label-driven: add a `release:minor` label to a PR, merge it, and `auto-changeset.yml` would generate a changeset file, which accumulated into a long-lived "Version Packages" PR. Merging that PR published everything.

It worked, but the friction compounded:

- **Changeset generation was invisible.** You couldn't see what the changeset said until after the PR merged.
- **The Version Packages PR was a bottleneck.** It sat open accumulating changes, and merging it was an all-or-nothing event.
- **No way to test unreleased changes.** If you wanted to try a package before it hit `@latest`, you had to link locally or publish manually.

The new process fixes all three: changesets are manual (you write them), canary releases are automatic (every push to main), and stable releases are intentional (you trigger them when ready).

## Release Philosophy

Three principles:

1. **Changesets are manual.** You write the changeset as part of your PR, alongside the code. This means the changelog message is deliberate, reviewed, and committed before merge.
2. **Canary is automatic.** Every push to main that includes changeset files publishes a `@canary` release. No action needed. This gives consumers a way to test unreleased changes immediately.
3. **Stable is intentional.** You trigger a stable release when you're ready. The workflow versions packages, opens a PR for review, and publishes on merge. No surprises.

## Canary Releases

**Trigger:** Push to `main` that touches `.changeset/*.md` files.

**Workflow:** [`release-canary.yml`](../.github/workflows/release-canary.yml)

When changeset files exist on main, the canary workflow automatically:

1. Builds all packages
2. Publishes to npm with the `@canary` dist-tag
3. Uses snapshot versioning: `x.y.z-canary-YYYYMMDDHHMMSS`

Changeset files are **not consumed** during canary releases. They stay in the `.changeset/` directory until a stable release consumes them.

### Installing Canary Versions

```bash
bun add @outfitter/cli@canary
```

Canary versions are useful for testing unreleased changes in downstream projects without waiting for a stable release.

## Stable Releases

**Trigger:** Manual `workflow_dispatch` followed by PR merge.

**Workflow:** [`release.yml`](../.github/workflows/release.yml)

Stable releases are a two-phase process:

### Phase 1: Prepare

1. Go to **Actions > Release > Run workflow** in GitHub
2. The workflow versions packages (`changeset version`), consuming all changeset files
3. The workflow refreshes tracked LLM artifacts (`docs/llms.txt`, `docs/llms-full.txt`)
4. A `release/YYYYMMDD-HHMMSS` branch is created with version bumps, changelog updates, and any llms artifact updates
5. A PR is opened against `main` with the `autorelease` label

### Phase 2: Publish

1. Review the release PR — check version bumps, changelog entries, and CI status
2. Merge the PR
3. The publish job detects the `autorelease` label and `release/` branch prefix
4. The publish job verifies llms artifacts are deterministic and up to date
5. Packages are built, tested, and published to npm with the `@latest` dist-tag
6. Git tags are created for each published package

### Requirements

- **PAT token:** The prepare phase uses `RELEASE_PLEASE_TOKEN` (a Personal Access Token) so the release PR can trigger CI workflows. GitHub's default `GITHUB_TOKEN` doesn't trigger workflows on PRs it creates.
- **npm-publish environment:** Both canary and stable publish jobs use the `npm-publish` GitHub environment with OIDC-based npm authentication.

## Adding Changesets

When your PR includes changes that should be released, add a changeset:

```bash
bun changeset
```

This prompts you to:

1. Select which packages changed
2. Choose the semver bump type (major, minor, patch)
3. Write a summary for the changelog

The generated `.changeset/*.md` file should be committed with your PR.

### Choosing a Bump Type

| Type    | When to Use                                               | Example            |
| ------- | --------------------------------------------------------- | ------------------ |
| `patch` | Bug fixes, dependency updates, docs fixes in code         | `0.1.0` -> `0.1.1` |
| `minor` | New features, new exports, deprecations                   | `0.1.0` -> `0.2.0` |
| `major` | Breaking API changes, removed exports, changed signatures | `0.1.0` -> `1.0.0` |

### When NOT to Add a Changeset

Some changes don't need a release:

- Documentation updates (`docs/`, README files)
- CI/CD workflow changes
- Test-only changes
- Editor/tooling configuration

For these PRs, add the `release:none` label so CI doesn't flag a missing changeset.

## Guardrails

### Workspace Range Rewriting

Packages use `workspace:*` and `catalog:` ranges internally. The publish script ([`changeset-publish.ts`](../scripts/changeset-publish.ts)) rewrites these to concrete versions before publishing and restores originals after. This happens automatically during both canary and stable releases.

### prepublishOnly Check

Every public package defines a `prepublishOnly` script that runs [`check-publish-manifest.ts`](../scripts/check-publish-manifest.ts). This catches any attempt to `npm publish` directly from a package directory, which would leak unresolved `workspace:*` ranges.

Always publish through the release pipeline, never directly.

### Concurrency Guards

`release-canary.yml` and `release.yml` each use their own concurrency group to prevent overlapping runs of the same workflow. Canary and stable publishes can run concurrently since they write to different dist-tags (`@canary` vs `@latest`).

### Snapshot Versioning

Canary versions use the format `{version}-canary-{datetime}` (configured in `.changeset/config.json`). This ensures every canary has a unique, time-sortable version without polluting the semver range.

## Workflows

| Workflow                                                        | Trigger                            | Purpose                                               |
| --------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| [`release-canary.yml`](../.github/workflows/release-canary.yml) | Push to main (changeset files)     | Publish `@canary` dist-tag                            |
| [`release.yml`](../.github/workflows/release.yml)               | Manual dispatch / release PR merge | Two-phase: prepare release PR, then publish `@latest` |
| [`auto-label.yml`](../.github/workflows/auto-label.yml)         | PR open/update                     | Apply release label from changeset                    |

## Release Labels

Labels still exist for human categorization, but they no longer drive automation:

| Label           | Purpose                              |
| --------------- | ------------------------------------ |
| `release:patch` | Categorize as bug fix                |
| `release:minor` | Categorize as new feature            |
| `release:major` | Categorize as breaking change        |
| `release:none`  | Skip changeset requirement in CI     |
| `autorelease`   | Applied automatically to release PRs |

## Troubleshooting

### No canary was published after merging

The canary workflow only triggers when `.changeset/*.md` files are present on the push to main. Check that:

- Your changeset file was committed and merged (not just the code)
- The file is in `.changeset/` with a `.md` extension (not `README.md`)

### Prepare workflow says "No changesets found"

All changesets have been consumed by a previous prepare run, or none were ever added. Add changesets to pending PRs and merge them before running prepare again.

### Release PR didn't trigger CI

The release PR must be created with a PAT (`RELEASE_PLEASE_TOKEN`), not the default `GITHUB_TOKEN`. If CI didn't run, check that the secret is configured in the repository settings.

### Published package has workspace:\* in dependencies

This means someone ran `npm publish` directly instead of using the release pipeline. The `prepublishOnly` guard should prevent this, but if it was bypassed, unpublish the version and re-release through the pipeline.

### Need to release immediately

1. Run the prepare workflow (`Actions > Release > Run workflow`)
2. Review and merge the release PR
3. Packages publish automatically on merge

## Related Documentation

- [CI/CD Overview](./ci-cd/README.md) -- All workflows at a glance
- [Auto-Labeling](./ci-cd/auto-labeling.md) -- How PRs get labeled
- [Changesets Documentation](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md) -- Upstream docs

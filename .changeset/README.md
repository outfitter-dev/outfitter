# Changesets

This directory is used by [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Adding a changeset

When you make a change that should be released, run:

```bash
bun changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the semver bump type (major, minor, patch)
3. Write a summary of the changes

## Releasing

To release all changesets:

```bash
bun run version-packages  # Updates versions and changelogs
bun run release           # Builds and publishes to npm
```

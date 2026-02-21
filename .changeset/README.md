# Changesets

When your PR includes changes that should be released, add a changeset:

```bash
bun changeset
```

This prompts you to select affected packages, choose a semver bump type, and write a changelog summary. Commit the generated file with your PR.

## What Happens After Merge

- **Canary:** Every push to main with changeset files publishes `@canary` versions automatically. Changeset files are not consumed.
- **Stable:** Triggered manually via **Actions > Release > Run workflow**. This versions packages, opens a release PR, and publishes `@latest` on merge.

For the full release process, see [docs/RELEASES.md](../docs/RELEASES.md).

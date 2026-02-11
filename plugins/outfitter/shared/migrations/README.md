# Migration Docs

Versioned migration guides for `@outfitter/*` packages. Used by the `outfitter-check` skill and `outfitter update` CLI command to compose upgrade guidance.

## Naming Convention

```
outfitter-<package>-<version>.md
```

Examples:
- `outfitter-contracts-0.2.0.md`
- `outfitter-cli-0.2.0.md`
- `outfitter-contracts-0.2.1.md`
- `outfitter-cli-0.3.0.md`

## Ordering

Migration docs are applied sequentially by version (semver ascending). Within a version, packages are ordered by dependency tier:

1. **Foundation**: contracts, types
2. **Runtime**: cli, mcp, config, logging, file-ops, state, index, daemon, testing
3. **Tooling**: outfitter (umbrella CLI)

## Template

```markdown
---
package: @outfitter/<name>
version: 0.2.0
breaking: false
---

# @outfitter/<name> → 0.2.0

## New APIs

<what's available now, with code examples>

## Migration Steps

<specific things to change, with before/after>

## No Action Required

<things that just work after bumping>
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `package` | string | Full package name (`@outfitter/contracts`) |
| `version` | string | Target version |
| `breaking` | boolean | Whether this version has breaking changes |

## Adding New Migration Docs

When releasing a new version:

1. Create `outfitter-<package>-<version>.md` for each package with changes
2. Follow the template above
3. Include before/after code examples for any API changes
4. Mark `breaking: true` if there are breaking changes
5. Omit packages that only received dependency bumps (no API changes)

## Current Docs Snapshot

The migration set currently includes:

- Foundation updates through `@outfitter/contracts` `0.2.1` (planned release)
- Runtime updates through `@outfitter/cli`, `@outfitter/config`,
  `@outfitter/logging`, and `@outfitter/mcp` `0.3.0`

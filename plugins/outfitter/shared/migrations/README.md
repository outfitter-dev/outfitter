# Migration Docs

Versioned migration guides for `@outfitter/*` packages. Used by the `outfitter-check` skill and `outfitter upgrade` CLI command to compose upgrade guidance.

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
2. **Runtime**: cli, mcp, config, logging, file-ops, state, index, schema, tui, daemon, testing
3. **Tooling**: outfitter (umbrella CLI)

## Template

```markdown
---
package: @outfitter/<name>
version: 0.2.0
breaking: false
changes:
  - type: renamed
    from: "@outfitter/<name>/old-path"
    to: "@outfitter/<name>/new-path"
    codemod: "<name>/0.2.0-description.ts"
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

| Field      | Type    | Description                                     |
| ---------- | ------- | ----------------------------------------------- |
| `package`  | string  | Full package name (`@outfitter/contracts`)      |
| `version`  | string  | Target version                                  |
| `breaking` | boolean | Whether this version has breaking changes       |
| `changes`  | array   | Structured change entries (optional, see below) |

### Changes Array

Each entry in `changes` describes one machine-actionable change. Used by `outfitter upgrade` to discover and run codemods.

| Field     | Type   | Description                                                                       |
| --------- | ------ | --------------------------------------------------------------------------------- |
| `type`    | string | One of: `renamed`, `removed`, `signature-changed`, `moved`, `deprecated`, `added` |
| `from`    | string | Previous import path, export name, or identifier                                  |
| `to`      | string | New import path, export name, or identifier                                       |
| `path`    | string | Package path where the export lives                                               |
| `export`  | string | Exported symbol name                                                              |
| `detail`  | string | Human-readable migration note                                                     |
| `codemod` | string | Path to codemod script relative to `shared/codemods/`                             |

All fields except `type` are optional. Include what's relevant for each change.

## Adding New Migration Docs

When releasing a new version:

1. Create `outfitter-<package>-<version>.md` for each package with changes
2. Follow the template above
3. Include before/after code examples for any API changes
4. Mark `breaking: true` if there are breaking changes
5. Omit packages that only received dependency bumps (no API changes)

## Current Docs Snapshot

The migration set currently includes:

- Foundation updates through `@outfitter/contracts` `0.2.1`
- Runtime updates through `@outfitter/cli` `0.4.1`, `@outfitter/mcp` `0.4.0`, `@outfitter/logging` `0.4.0`
- New package docs for `@outfitter/schema` `0.1.0` and `@outfitter/tui` `0.2.0`
- Patch-range docs for `@outfitter/config`, `@outfitter/daemon`, `@outfitter/file-ops`, `@outfitter/index`, `@outfitter/state`, `@outfitter/testing`, and `@outfitter/tooling`

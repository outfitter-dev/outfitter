# AGENTS.md

Guidelines for AI agents and developers working in this repository.

## Project Overview

Outfitter is a Bun-first monorepo providing shared infrastructure for AI-agent-ready tooling. It includes reusable libraries for CLI, MCP servers, daemons, and indexing, plus an umbrella CLI (`outfitter`) for scaffolding.

**Status**: v0.1.0-rc.1 (release candidate)

**Linear Team**: Stack (`OS`)

## Project Structure

- `apps/` — Runnable applications; `apps/outfitter/` is the CLI and scaffolding templates
- `packages/` — Versioned libraries (`@outfitter/*`) with source in `src/`
- `templates/` — Shared templates
- `docs/` — Specs and plan documents

Tests live alongside code in `src/__tests__/` with `*.test.ts` files; snapshots use `__snapshots__/` with `.snap` format.

## Commands

```bash
# Build
bun run build                              # All packages (Turbo + bunup)
bun run build --filter=@outfitter/cli      # Single package

# Test
bun run test                               # All packages
bun run test --filter=@outfitter/contracts # Single package
bun run test:watch                         # Watch mode
cd packages/contracts && bun test          # Direct invocation

# Lint/Format
bun run lint                               # Check
bun run lint:fix                           # Fix
bun run format                             # Format
bun run typecheck                          # TypeScript validation

# Release
bun run changeset                          # Add changeset
bun run version-packages                   # Bump versions
bun run release                            # Build + publish

# Maintenance
bun run clean                              # Clear Turbo artifacts and node_modules
```

## Architecture

### Package Tiers (dependency flow: Foundation → Runtime → Tooling)

**Foundation (cold)** — Stable, rarely change:
- `@outfitter/contracts` — Result/Error patterns, error taxonomy (10 categories → exit/HTTP codes)
- `@outfitter/types` — Branded types, type utilities

**Runtime (warm)** — Active development:
- `@outfitter/cli` — Typed Commander wrapper with output contract
- `@outfitter/mcp` — MCP server framework with typed tools and action registry
- `@outfitter/config` — XDG-compliant config loading with Zod validation
- `@outfitter/logging` — Structured logging via logtape
- `@outfitter/file-ops` — Workspace detection, path security, locking
- `@outfitter/state` — Pagination state, cursor persistence
- `@outfitter/ui` — Terminal output, colors, renderers
- `@outfitter/index` — SQLite FTS5 with WAL
- `@outfitter/daemon` — Daemon lifecycle, IPC, health checks
- `@outfitter/testing` — Test harnesses for MCP and CLI

**Tooling (lukewarm)**:
- `outfitter` — Umbrella CLI for scaffolding

### Handler Contract

All domain logic uses transport-agnostic handlers returning `Result<T, E>`:

```typescript
type Handler<TInput, TOutput, TError> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<Result<TOutput, TError>>;
```

CLI and MCP are thin adapters over shared handlers. Handlers know nothing about output format or transport.

### Error Taxonomy

10 error categories with mapped exit codes and HTTP status:

| Category | Exit | HTTP |
|----------|------|------|
| validation | 1 | 400 |
| not_found | 2 | 404 |
| conflict | 3 | 409 |
| permission | 4 | 403 |
| timeout | 5 | 504 |
| rate_limit | 6 | 429 |
| network | 7 | 503 |
| internal | 8 | 500 |
| auth | 9 | 401 |
| cancelled | 130 | 499 |

## Development Principles

### TDD-First (Non-Negotiable)

1. **Red**: Write failing test that defines behavior
2. **Green**: Minimal code to pass
3. **Refactor**: Improve while green

Never write implementation before the test.

### Bun-First

Use Bun-native APIs before npm packages:
- `Bun.hash()`, `Bun.Glob`, `Bun.semver`, `Bun.$`
- `Bun.color()`, `Bun.stringWidth()`, `Bun.stripANSI()`
- `bun:sqlite` for SQLite with FTS5

### Blessed Dependencies

| Concern | Package |
|---------|---------|
| Result type | `better-result` |
| Schema validation | `zod` (v4) |
| CLI parsing | `commander` (v14+) |
| Logging | `@logtape/logtape` |
| MCP protocol | `@modelcontextprotocol/sdk` |
| Prompts | `@clack/prompts` |

## Code Style

### TypeScript

Strict mode with additional safety flags:
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`

Keep types explicit; avoid `any`. Prefer module-local organization over central registries.

### Formatting (Biome)

- Tabs (width 2), double quotes, always semicolons
- Trailing commas, 100 char line width

## Testing

- Primary runner: Bun's test runner
- Test files: `src/__tests__/*.test.ts`
- Snapshots: `__snapshots__/*.snap`
- Run focused tests from a package (`bun test`) or full suite from root (`bun run test`)

## Git Workflow

### Branch Naming

Short and descriptive: `feature/<area>/<slug>` or `fix/<area>/<slug>`

### Commits

Conventional Commits with scopes:
```
feat(outfitter): add action registry
fix(cli): handle missing config gracefully
```

### Pull Requests

- Include clear summary and tests run
- Document user-visible changes
- Use short-lived branches off `main`
- Open PRs early, squash-merge once checks pass

### Git Hooks (Lefthook)

- **pre-commit**: Format, lint, typecheck (affected packages)
- **pre-push**: Full test suite (TDD-aware: allows RED phase branches like `*-tests`)

### Changesets

For package-impacting changes:
1. Add changeset: `bun run changeset`
2. Version: `bun run version-packages`
3. Publish: `bun run release`

## Key Files

- `SPEC.md` — Complete technical specification
- `PLAN.md` — Implementation roadmap

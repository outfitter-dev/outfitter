# Discoverability Guide

How to find what's available in the Outfitter stack: subpath exports, tooling surface, and peer dependency requirements.

## Subpath Export Maps

Every `@outfitter/*` package uses Node.js [subpath exports](https://nodejs.org/api/packages.html#subpath-exports) to expose focused entry points. Import from the most specific subpath that meets your needs — this enables better tree-shaking and makes dependencies explicit.

### @outfitter/cli

| Import Path                         | Description                                                                                                                                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@outfitter/cli`                    | Minimal root — `ANSI`, `createTheme`, `output`, `exitWithError`, `OutputMode` type                                                                                                                                                                                         |
| `@outfitter/cli/actions`            | Build Commander commands from action registries (`buildCliCommands`, `actionCliPresets`)                                                                                                                                                                                   |
| `@outfitter/cli/colors`             | ANSI constants, color application, semantic theme and token utilities                                                                                                                                                                                                      |
| `@outfitter/cli/command`            | `createCLI`, fluent `command()` builder, `CLI`/`CommandBuilder` types                                                                                                                                                                                                      |
| `@outfitter/cli/completion`         | Shell completion generation and command registration (bash/zsh/fish)                                                                                                                                                                                                       |
| `@outfitter/cli/flags`              | Composable flag presets — `createPreset`, `composePresets`, and built-ins (`cwdPreset`, `dryRunPreset`, `verbosePreset`, `forcePreset`, `interactionPreset`, `strictPreset`, `colorPreset`, `projectionPreset`, `timeWindowPreset`, `executionPreset`, `paginationPreset`) |
| `@outfitter/cli/input`              | Input parsing helpers — `collectIds`, `expandFileArg`, `parseGlob`, `parseKeyValue`, `parseRange`, `parseFilter`, `parseSortSpec`                                                                                                                                          |
| `@outfitter/cli/output`             | Output-mode-aware rendering (`output`), error exit handling (`exitWithError`), verbose resolution                                                                                                                                                                          |
| `@outfitter/cli/pagination`         | XDG state-backed cursor persistence (`loadCursor`, `saveCursor`, `clearCursor`)                                                                                                                                                                                            |
| `@outfitter/cli/query`              | Centralized output-mode resolution (`resolveOutputMode`, `outputModePreset`) and `jqPreset`                                                                                                                                                                                |
| `@outfitter/cli/schema`             | Schema introspection commands — `createSchemaCommand`, manifest generation and formatting                                                                                                                                                                                  |
| `@outfitter/cli/terminal`           | Terminal capability detection — color support, width, interactivity                                                                                                                                                                                                        |
| `@outfitter/cli/terminal/detection` | Direct terminal detection implementation (same API as `./terminal`)                                                                                                                                                                                                        |
| `@outfitter/cli/text`               | ANSI-aware text utilities — `stripAnsi`, `getStringWidth`, `wrapText`, `truncateText`, `padText`, `pluralize`, `slugify`                                                                                                                                                   |
| `@outfitter/cli/types`              | Shared type surface — CLI config, command, flag preset, output mode, and error type re-exports                                                                                                                                                                             |
| `@outfitter/cli/verbs`              | Standard verb-family conventions (`VERB_FAMILIES`, `resolveVerb`, `applyVerb`)                                                                                                                                                                                             |

### @outfitter/contracts

| Import Path                             | Description                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@outfitter/contracts`                  | Barrel export aggregating all core Result/Error contracts and utilities                                                     |
| `@outfitter/contracts/actions`          | Action definition and registry (`defineAction`, `createActionRegistry`, `ACTION_SURFACES`)                                  |
| `@outfitter/contracts/adapters`         | Pluggable backend adapter interfaces — index, cache, auth, storage (all Result-based)                                       |
| `@outfitter/contracts/assert`           | Type-safe assertions (`assertDefined`, `assertNonEmpty`, `assertMatches`) and Result test helpers (`expectOk`, `expectErr`) |
| `@outfitter/contracts/capabilities`     | Action capability manifest (`CAPABILITY_SURFACES`, `ACTION_CAPABILITIES`, `getActionsForSurface`)                           |
| `@outfitter/contracts/context`          | Handler context factory (`createContext`, `generateRequestId`)                                                              |
| `@outfitter/contracts/envelope`         | Result-to-envelope conversion (`toEnvelope`, `toHttpResponse`) for API responses                                            |
| `@outfitter/contracts/errors`           | Full error taxonomy — `ErrorCategory`, `OutfitterError`, concrete error classes, exit/HTTP code maps                        |
| `@outfitter/contracts/from-fetch`       | HTTP Response to Result mapping (`fromFetch`) using taxonomy-aligned categories                                             |
| `@outfitter/contracts/handler`          | Transport-agnostic handler contracts (`Handler`, `SyncHandler`, `HandlerContext`)                                           |
| `@outfitter/contracts/logging`          | Backend-agnostic logging interfaces (`Logger`, `LoggerFactory`, `createLoggerFactory`)                                      |
| `@outfitter/contracts/recovery`         | Retry/backoff decision helpers (`isRecoverable`, `isRetryable`, `shouldRetry`, `getBackoffDelay`)                           |
| `@outfitter/contracts/redactor`         | Configurable sensitive data redaction (`createRedactor`, patterns for keys and values)                                      |
| `@outfitter/contracts/resilience`       | Resilience wrappers — `retry` with backoff and `withTimeout` for async Result operations                                    |
| `@outfitter/contracts/result`           | Result combinators (`combine2`, `combine3`, `unwrapOrElse`, `orElse`, `expect`)                                             |
| `@outfitter/contracts/result/utilities` | Same combinators as `./result` — direct import path                                                                         |
| `@outfitter/contracts/schema`           | Zod-to-JSON-Schema conversion (`zodToJsonSchema`) for introspection and transport                                           |
| `@outfitter/contracts/serialization`    | Error serialization/deserialization and safe JSON helpers (`safeStringify`, `safeParse`)                                    |
| `@outfitter/contracts/validation`       | Zod-to-Result validation (`createValidator`, `validateInput`, `parseInput`)                                                 |
| `@outfitter/contracts/wrap-error`       | Unknown error normalization (`wrapError`, `composeMappers`, `isOutfitterError`)                                             |

### @outfitter/mcp

| Import Path                 | Description                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@outfitter/mcp`            | Barrel export combining all MCP server, tool, and transport surfaces                                              |
| `@outfitter/mcp/actions`    | Convert action registries to MCP tool definitions (`buildMcpTools`)                                               |
| `@outfitter/mcp/core-tools` | Built-in MCP tools — `defineDocsTool`, `defineConfigTool`, `defineQueryTool`, `createCoreTools`                   |
| `@outfitter/mcp/logging`    | Log-level bridge between Outfitter and MCP levels (`mapLogLevelToMcp`, `shouldEmitLog`)                           |
| `@outfitter/mcp/schema`     | Zod-to-JSON-Schema re-export from `@outfitter/contracts/schema`                                                   |
| `@outfitter/mcp/server`     | Core MCP server — `createMcpServer`, `defineTool`, `defineResource`, `defineResourceTemplate`, `definePrompt`     |
| `@outfitter/mcp/transport`  | SDK transport bridge (`createSdkServer`, `connectStdio`) and response helpers (`wrapToolResult`, `wrapToolError`) |
| `@outfitter/mcp/types`      | MCP type system — `ToolDefinition`, `McpServer`, `McpError`, `TOOL_ANNOTATIONS`, `adaptHandler`                   |

### @outfitter/testing

| Import Path                         | Description                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `@outfitter/testing`                | Barrel export for all test harnesses, fixtures, and helpers                                           |
| `@outfitter/testing/cli-harness`    | CLI process harness (`createCliHarness`) — spawns CLI and captures stdout/stderr/exitCode             |
| `@outfitter/testing/cli-helpers`    | In-process CLI capture (`captureCLI`) and stdin mocking (`mockStdin`)                                 |
| `@outfitter/testing/fixtures`       | Fixture factory (`createFixture`), temp directory lifecycle (`withTempDir`), env override (`withEnv`) |
| `@outfitter/testing/mcp-harness`    | MCP test harness (`createMcpHarness`, `createMcpTestHarness`) for tool invocation testing             |
| `@outfitter/testing/mock-factories` | Mock factories for tests (`createTestLogger`, `createTestConfig`, `createTestContext`)                |
| `@outfitter/testing/test-command`   | CLI wiring test helper (`testCommand`) — runs CLI with captured output, no side effects               |
| `@outfitter/testing/test-tool`      | MCP tool test helper (`testTool`) — validates input schema and invokes handler                        |

## Existing Tooling Surface

Outfitter ships several built-in tools for verifying package health, export correctness, and schema consistency. These live in the `outfitter` CLI.

### Export Validation

**`outfitter repo check exports`** — Validates that every entry in `package.json` `exports` has a corresponding source file. Catches phantom exports (declared in package.json but missing on disk).

```bash
# Run from monorepo root
bun run check-exports

# Or via the CLI directly
outfitter repo check exports --cwd .

# JSON output
outfitter repo check exports --json
```

**`outfitter repo check readme`** — Validates that README import examples match actual `package.json` exports. Catches outdated code examples referencing renamed or removed subpaths.

```bash
outfitter repo check readme
```

### Schema Introspection

**`outfitter schema`** — Shows the full action registry schema including input/output shapes, surfaces, and CLI options.

```bash
# Human-readable overview of all actions
outfitter schema

# Detail for a specific action
outfitter schema check.tsdoc

# Machine-readable JSON
outfitter schema check.tsdoc --output json
```

**`outfitter schema generate`** — Writes `.outfitter/surface.json`, the canonical surface map of all registered actions. Used for drift detection.

```bash
outfitter schema generate
```

**`outfitter schema diff`** — Compares runtime schema against the committed `.outfitter/surface.json`. Exits non-zero on drift. Run this in CI or before pushing to catch unregistered actions or schema changes.

```bash
# In CI or pre-push hook
outfitter schema diff

# From root scripts
bun run schema:diff
```

**`outfitter schema docs`** — Generates markdown reference documentation from the action registry.

```bash
outfitter schema docs
```

### Check Commands

**`outfitter check`** — Block drift detection. Compares local config blocks against the registry. Supports orchestration modes for different CI stages.

```bash
# Basic drift check
outfitter check

# CI mode (includes tests)
outfitter check --ci

# Pre-push mode
outfitter check --pre-push

# Check a specific block
outfitter check -b linter
```

**`outfitter check tsdoc`** — Checks TSDoc coverage on exported declarations.

```bash
outfitter check tsdoc
```

**`outfitter check publish-guardrails`** — Validates publishable package manifests enforce `prepublishOnly` guardrails.

```bash
outfitter check publish-guardrails
```

**`outfitter check preset-versions`** — Validates preset dependency versions, registry versions, and Bun version consistency.

```bash
outfitter check preset-versions
```

**`outfitter check surface-map`** — Validates canonical surface map path usage (only `.outfitter/surface.json`).

```bash
outfitter check surface-map
```

**`outfitter check surface-map-format`** — Validates canonical formatting for `.outfitter/surface.json`.

```bash
outfitter check surface-map-format
```

**`outfitter check docs-sentinel`** — Validates `docs/README.md` PACKAGE_LIST sentinel freshness.

```bash
outfitter check docs-sentinel
```

**`outfitter check action-ceremony`** — Validates action ceremony guardrails in `apps/outfitter/src/actions`.

```bash
outfitter check action-ceremony
```

### Repository Maintenance

**`outfitter repo check registry`** — Validates packages with `bunup --filter` are registered in `bunup.config.ts`.

**`outfitter repo check changeset`** — Validates PRs touching package source include a changeset.

**`outfitter repo check tree`** — Asserts working tree is clean (no modified or untracked files).

**`outfitter repo check boundary-invocations`** — Validates root/app scripts do not execute `packages/*/src` entrypoints directly.

**`outfitter repo check markdown-links`** — Validates relative links in markdown files resolve to existing files.

### Documentation Tools

**`outfitter docs list`** — Lists all documentation entries from the docs map.

**`outfitter docs show <id>`** — Shows a specific documentation entry and its content.

**`outfitter docs search <query>`** — Searches documentation content.

**`outfitter docs api`** — Extracts API reference from TSDoc coverage data.

**`outfitter docs export`** — Exports documentation to packages, `llms.txt`, or both.

## Peer Dependencies

Packages that require peer dependencies are listed below. Install the required peers alongside the package. Optional peers are only needed for specific features.

### @outfitter/cli

```json
{
  "peerDependencies": {
    "@outfitter/config": ">=0.3.0",
    "@outfitter/contracts": ">=0.2.0",
    "@outfitter/schema": ">=0.1.0",
    "@outfitter/types": ">=0.2.0",
    "commander": ">=14.0.0",
    "zod": ">=4.0.0"
  }
}
```

| Peer                   | Required For                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `commander`            | **Required** — `createCLI`, `command()`, all CLI construction                       |
| `@outfitter/contracts` | **Required** — `output()`, `exitWithError()`, error taxonomy, type definitions      |
| `@outfitter/config`    | **Required** — Environment/verbose resolution in `./output`, terminal detection     |
| `@outfitter/schema`    | Optional — Schema introspection via `./schema` subpath only                         |
| `zod`                  | Optional — Action schema definitions via `./actions` (transitive via `contracts`)   |
| `@outfitter/types`     | Optional — Version alignment only (not directly imported)                           |

See [CLI peer dependency details](../../packages/cli/docs/peer-dependencies.md) for the full subpath-to-peer matrix.

### @outfitter/mcp

```json
{
  "peerDependencies": {
    "@outfitter/config": ">=0.3.0",
    "@outfitter/contracts": ">=0.2.0",
    "@outfitter/logging": ">=0.3.0"
  }
}
```

| Peer                   | Required For                                              |
| ---------------------- | --------------------------------------------------------- |
| `@outfitter/contracts` | **Core** — Result types, error classes, handler contracts |
| `@outfitter/logging`   | **Core** — Logger integration via `./logging` subpath     |
| `@outfitter/config`    | Config loading for server configuration                   |

### @outfitter/contracts

No peer dependencies. `@outfitter/contracts` depends only on `better-result` and `zod` (direct dependencies).

### @outfitter/testing

No peer dependencies. `@outfitter/testing` depends directly on `@outfitter/cli`, `@outfitter/contracts`, `@outfitter/mcp`, and `zod`.

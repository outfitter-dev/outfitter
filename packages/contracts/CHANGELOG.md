# @outfitter/contracts

## 0.5.0

### Minor Changes

- 2d9e5fa: Add `expectOk(result)` and `expectErr(result)` test assertion helpers. `expectOk` asserts a Result is Ok and returns the narrowed `T` value; throws a descriptive error if Err. `expectErr` does the inverse — asserts Err and returns narrowed `E`. Both accept an optional message parameter and work with Bun's test runner.
- 2d9e5fa: Add `fromFetch(response)` helper that converts an HTTP Response into a `Result<Response, OutfitterError>`. Maps HTTP status codes to error categories per the taxonomy: 2xx → Ok, 404 → not_found, 401 → auth, 429 → rate_limit, 403 → permission, 408/504 → timeout, 502/503 → network, 409 → conflict, other 5xx → internal.
- f4f5cdf: Add `ActionHint`, `CLIHint`, and `MCPHint` types for agent-navigable responses. Exported from `@outfitter/contracts` root and `@outfitter/contracts/hints` subpath. Types only — no runtime code.
- e5ab5d0: Add `.readOnly(bool)` and `.idempotent(bool)` methods to `CommandBuilder` for declaring safety metadata on commands. When set to `true`, these signals are included in the self-documenting root command tree (JSON mode) under a `metadata` field. In the MCP package, `buildMcpTools()` maps `readOnly` to `readOnlyHint` and `idempotent` to `idempotentHint` in MCP tool annotations via the `ActionMcpSpec` interface. Default is non-read-only, non-idempotent (metadata omitted when not set).
- 2d9e5fa: Add `parseInput(schema, data)` Zod-to-Result helper. Wraps `safeParse` into `Result<T, ValidationError>` where `T` is automatically inferred from the schema — no manual type argument needed.
- c21b340: Add transport-agnostic streaming types: `StreamEvent` discriminated union (`StreamStartEvent`, `StreamStepEvent`, `StreamProgressEvent`), `ProgressCallback` type, and optional `progress` field on `HandlerContext`. Handlers can call `ctx.progress?.()` to emit progress events without knowing which transport consumes them.
- 2d9e5fa: Add `wrapError(error, mapper?)` for normalizing unknown errors into typed OutfitterErrors. Typed errors pass through unchanged (same reference, mapper not called). Untyped errors go through optional mapper; unmatched errors wrap as InternalError. Also adds `composeMappers()` for composable mapper pipelines that short-circuit on first match, and `isOutfitterError()` type guard.
- 1359264: Add `jsonRpcCodeMap`, `retryableMap`, and `errorCategoryMeta()` to enrich ErrorCategory with JSON-RPC codes (for MCP protocol compliance) and retryable flags (for agent safety)

### Patch Changes

- 56594cb: Add standalone reference project in examples/ demonstrating v0.4-v0.6 integration
- 5079ff4: Export `extractMessage` utility from wrap-error module for reuse across packages.
- a151534: Document intentional large-file exemptions and remove the remaining package-boundary lint violations that blocked repo verification across the affected runtime packages.
- cc525da: Refresh release metadata for the remaining stacked contracts follow-up PRs after the base changeset merged to `main`.
- cb36241: Land the stacked follow-up fixes across tooling, runtime, and scaffold packages after the repo-shape cleanup.

## 0.4.2

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

## 0.4.1

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).

## 0.4.0

### Minor Changes

- 13b36de: Move `zodToJsonSchema` from `@outfitter/mcp` to `@outfitter/contracts`. MCP re-exports for backward compatibility.

## 0.3.0

### Minor Changes

- d683522: Add `ValidationError.fromMessage()` and improve error factory documentation.
  - **feat**: `ValidationError.fromMessage(message, context?)` for freeform validation errors (#335)
  - **docs**: Error factory quick-reference table and casing behavior documentation (#336)

## 0.2.0

### Minor Changes

- Add error ergonomics and Result boundary helpers
  - Add optional `context` field to `NotFoundError` and `ValidationError` for attaching structured domain metadata
  - Add `static create()` factory methods to all 10 error classes for concise construction
  - Add `AmbiguousError` class (category: `validation`, code: `AMBIGUOUS_MATCH`) for disambiguation scenarios with a `candidates` field
  - Add `expect(result, message)` utility — unwraps Ok or throws with a contextual error message

## 0.1.0

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- 4f58c46: Add ERROR_CODES constant with granular numeric error codes organized by category

## 0.1.0-rc.3

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:

  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

## 0.1.0-rc.2

### Patch Changes

- Add ERROR_CODES constant with granular numeric error codes organized by category

## 0.1.0

### Minor Changes

- chore: align package versions to 0.1.0

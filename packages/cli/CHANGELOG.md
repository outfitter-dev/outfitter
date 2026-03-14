# Changelog

## 1.0.0

### Major Changes

- 72a1e71: Move `commander` from `dependencies` to `peerDependencies` with `>=14.0.0`. Consumers must now provide their own `commander` installation.
- 72a1e71: Add explicit `format` parameter to `output()` and `exitWithError()` for flag-driven format selection. The `mode` property has been removed from `OutputOptions`. Detection hierarchy (highest wins): (1) explicit `format` param, (2) env vars (`OUTFITTER_JSON`, `OUTFITTER_JSONL`), (3) default `"human"`. This is a breaking change to the function signatures.

### Minor Changes

- f4f5cdf: Add `.context(factory)` method to `CommandBuilder` for async context construction. The factory receives typed `TInput` (post-schema validation from `.input()`) or raw parsed flags (when `.input()` is not used) and returns a typed context object. The context is passed to the `.action()` handler alongside input via `ctx`. Context factory errors are caught and produce proper exit codes using the error taxonomy. Generic `TContext` type flows through `CommandBuilder` to the action handler for full type safety.
- e5ab5d0: Add `.destructive(isDest)` to `CommandBuilder` for marking commands as destructive. When `destructive(true)` is set, a `--dry-run` boolean flag is auto-added to the command (deduplicated if already present from `.option()` or `.preset()`). Add `dryRun` option to `runHandler()` — when `true`, the success envelope includes a CLIHint with the command to execute without `--dry-run` (preview-then-commit pattern). The handler is responsible for checking the dry-run flag and performing preview-only logic.
- 1359264: Add `output.envelope()` and `runHandler()` lifecycle bridge. `createSuccessEnvelope()` and `createErrorEnvelope()` wrap command results in a structured `{ ok, command, result/error, hints? }` envelope. The `hints` field is absent (not empty array) when there are no hints. `runHandler()` bridges the full CommandBuilder lifecycle: context factory → handler invocation → Result unwrap → envelope construction → output formatting → exit code mapping. Success produces `ok: true` with result; failure produces `ok: false` with error category and message. Exit codes come from the error taxonomy `exitCodeMap`. Exported from `@outfitter/cli/envelope` subpath.
- f4f5cdf: Add `.hints(fn)` and `.onError(fn)` to CommandBuilder for transport-local hint declarations. Success hint function receives `(result, input)` and error hint function receives `(error, input)`, both returning `CLIHint[]`. Handlers remain transport-agnostic — hint functions are stored on the builder and invoked at output time by `runHandler()`.
- f4f5cdf: Add `.input(schema)` method to `CommandBuilder` for Zod-to-Commander auto-derive. Accepts a Zod object schema and auto-derives Commander flags: `z.string()` → string option, `z.number()` → number option with coercion, `z.boolean()` → boolean flag, `z.enum()` → choices option. `.describe()` text becomes option descriptions, `.default()` values become option defaults. Explicit `.option()`/`.requiredOption()` calls compose alongside `.input()` — they override or supplement auto-derived flags. The `.action()` handler receives a validated, typed `input` object when `.input()` is used.
- e5ab5d0: Add `.readOnly(bool)` and `.idempotent(bool)` methods to `CommandBuilder` for declaring safety metadata on commands. When set to `true`, these signals are included in the self-documenting root command tree (JSON mode) under a `metadata` field. In the MCP package, `buildMcpTools()` maps `readOnly` to `readOnlyHint` and `idempotent` to `idempotentHint` in MCP tool annotations via the `ActionMcpSpec` interface. Default is non-read-only, non-idempotent (metadata omitted when not set).
- 2eadac8: Add output truncation with pagination hints and file pointers
  - New `truncation.ts` module: `truncateOutput()` function for truncating array output with configurable `limit` and `offset`
  - Without `limit`, output passes through untouched (off by default)
  - When data exceeds limit: truncates to limit items with `{ showing, total, truncated: true }` metadata
  - Generates pagination `CLIHint(s)` for continuation (`--offset`, `--limit`)
  - For very large output (>1000 items by default), writes full result to a temp file and includes `{ full_output: path }` file pointer
  - File write failures degrade gracefully (returns truncated output with warning hint, no crash)
  - Structured output (JSON/JSONL) remains parseable after truncation
  - File paths constrained to safe OS temp directories

- 2eadac8: Add `.relatedTo(target, options?)` to `CommandBuilder` for declaring relationships between commands. Declarations build a navigable action graph (tier-4 hints). `buildActionGraph()` constructs graph nodes (commands) and edges (relationships) from a Commander program. `graphSuccessHints()` generates next-action hints from graph neighbors for success envelopes. `graphErrorHints()` generates remediation-path hints for error envelopes. Unknown targets produce warnings (not crashes), self-links and cycles are handled safely.
- e5ab5d0: Surface `retryable` and `retry_after` in error envelopes. Error envelopes now include `retryable: boolean` derived from `errorCategoryMeta()`, indicating whether the error is transient and safe to retry. For `rate_limit` errors with `retryAfterSeconds`, the envelope also includes `retry_after` in seconds. Non-delay errors omit `retry_after`.
- 1359264: Add schema-driven presets via `createSchemaPreset()` and refactor `.preset()` to accept both `FlagPreset` and `SchemaPreset`. Schema presets use Zod schema fragments for auto-deriving Commander flags (same as `.input()`), eliminating the need for manual option declarations. Preset schemas compose with `.input()` — merged flags include both command input fields and preset fields. Existing `FlagPreset`-based presets continue to work unchanged (backward compatible). Also exports `isSchemaPreset()` type guard and `AnyPreset` union type.
- 1359264: Add self-documenting root command and hint generation tiers. When no subcommand is given, `createCLI()` outputs the full command tree as JSON (piped/JSON mode) or help text (TTY mode). The command tree includes all registered commands with descriptions and available options. Implement three hint generation tiers: Tier 1 (`commandTreeHints()`) auto-generates CLIHint[] from the Commander command registry. Tier 2 (`errorRecoveryHints()`) produces standard recovery actions per error category using enriched ErrorCategory metadata (retryable flags). Tier 3 (`schemaHintParams()`) populates hint params from Zod input schemas. All functions exported from `@outfitter/cli/hints` subpath.
- c21b340: Add NDJSON streaming adapter with `--stream` flag support
  - New `streaming.ts` module: `createNdjsonProgress()`, `writeNdjsonLine()`, `writeStreamEnvelope()` for writing progress events as NDJSON lines to stdout
  - New `streamPreset()` flag preset in `query.ts`: adds `--stream` boolean flag
  - `runHandler()` accepts `stream: true` option: emits start event, provides `ctx.progress` callback to handler, writes terminal envelope as last NDJSON line
  - `--stream` is orthogonal to output mode (`--output human|json|jsonl` and env vars)
  - Event ordering: start event first, progress/step events in middle, terminal envelope last

### Patch Changes

- 56594cb: Add standalone reference project in examples/ demonstrating v0.4-v0.6 integration
- 72a1e71: Fix `--json` global flag default from `false` to `undefined` so downstream code can distinguish "not passed" from "explicitly disabled". The preAction env bridge now only sets `OUTFITTER_JSON` when `--json` is explicitly passed.
- 7e94389: Fix 3 safety edge cases: (1) `.destructive()` is now order-agnostic with `.action()` — flag application deferred to `.build()` time. (2) `buildDryRunHint()` strips `--dry-run=true` and `--dry-run=<value>` variants. (3) `createErrorEnvelope()` only includes `retry_after` for `rate_limit` errors (defense-in-depth guard).
- c21b340: Replace raw JSON.stringify with safeStringify in NDJSON streaming and error envelope serialization paths for consistent BigInt handling, circular reference detection, and sensitive data redaction
- f4f5cdf: Fix `validateInput()` to surface Zod validation errors via `exitWithError()` instead of silently falling through to raw input. When `.input(schema)` is used and schema validation fails, the command now exits with code 1 (validation category) and outputs a `ValidationError` with Zod issue details (field names, expected types, messages). Invalid data no longer reaches `.action()` handlers.
- a151534: Document intentional large-file exemptions and remove the remaining package-boundary lint violations that blocked repo verification across the affected runtime packages.
- 7e94389: Fix 4 non-blocking edge cases: tempDir validation in truncateOutput() rejects unsafe paths (relative, traversal) with graceful fallback to OS tmpdir; buildActionGraph() now recursively traverses nested subcommands in group commands; cross-feature dry-run test reads actual flag from process.argv instead of hardcoded boolean; added optional truncation config on OutputOptions for future automatic truncation support.

## 0.5.3

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

## 0.5.2

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).

## 0.5.1

### Patch Changes

- 4352c6d: Add generic custom flag builders (`booleanFlagPreset`, `enumFlagPreset`, `numberFlagPreset`, `stringListFlagPreset`) for command-local CLI flags, and dogfood them in `outfitter upgrade` action wiring.

## 0.5.0

### Minor Changes

- 26f51bb: Add `schema` command for machine-readable CLI introspection. Auto-registered by `buildCliCommands()` — opt out with `schema: false`.
- 1c70a3e: Add markdown reference doc generation from action manifests. `formatManifestMarkdown()` converts manifests to readable markdown with surface-aware rendering — MCP shows JSON Schema parameters and deferred loading annotations, CLI shows flag syntax, defaults, and aliases. CLI gains `schema docs` subcommand for writing `MCP_REFERENCE.md` or `CLI_REFERENCE.md` to disk.

## 0.4.1

### Patch Changes

- 2395095: Fix TypeScript subpath export typing resolution for `@outfitter/cli/output` and related entry points in workspace typechecks.

## 0.4.0

### Minor Changes

- 839b4e1: Extract TUI modules to `@outfitter/tui` package.
  - **breaking**: Removed subpath exports: `./render`, `./table`, `./list`, `./box`, `./tree`, `./borders`, `./theme`, `./streaming`, `./prompt`, `./confirm`, `./preset`, `./demo`
  - **breaking**: `confirmDestructive()` moved from `@outfitter/cli/input` to `@outfitter/tui/confirm`
  - Colors (`./colors`), text utilities (`./text`), and terminal detection (`./terminal`) remain in `@outfitter/cli`
  - Install `@outfitter/tui` and update imports for moved modules

### Patch Changes

- d683522: Fix `--json` flag bridging to `OUTFITTER_JSON` environment variable.
  - **fix**: `createCLI()` now bridges `--json` (global or subcommand) into `OUTFITTER_JSON` via preAction/postAction hooks, eliminating manual `optsWithGlobals()` detection in commands (#340)
  - **chore**: Convert cross-package deps to peerDependencies (#344)

## 0.3.0

### Minor Changes

- 0c099bc: Add unified environment profiles (`OUTFITTER_ENV`) for cross-package defaults.

  **@outfitter/config:** New `getEnvironment()` and `getEnvironmentDefaults()` for reading environment profiles (development/production/test).

  **@outfitter/mcp:** Add `defaultLogLevel` option to `McpServerOptions` with precedence-based resolution: `OUTFITTER_LOG_LEVEL` > options > environment profile > null. Also adds `sendLogMessage()` for server-to-client log forwarding.

  **@outfitter/logging:** New `resolveLogLevel()` utility with precedence: `OUTFITTER_LOG_LEVEL` > explicit level > environment profile > "info".

  **@outfitter/cli:** New `resolveVerbose()` utility with precedence: `OUTFITTER_VERBOSE` > explicit flag > environment profile > false.

- 2da60d3: Add `--json` as a global CLI option, replacing per-command definitions. All commands now inherit `--json` automatically via `createCLI()`.

### Patch Changes

- 4894673: Complete migration system: add `--cwd` flag to `outfitter update`, ship migration docs in `@outfitter/kit` npm package, add migration docs for all packages.
- 8d48564: Fix `output()` to default to human mode for non-TTY environments. Previously, non-TTY output (piped, subprocess) unexpectedly emitted JSON. Machine-readable output now requires explicit `--json` flag or `OUTFITTER_JSON=1` env var, per CLI conventions.
- Updated dependencies [0c099bc]
  - @outfitter/config@0.3.0

## 0.2.0

### Minor Changes

- Add JSON output mode, command normalization, and prompt improvements
  - Normalize command signatures so argument syntax is separated from command name during registration
  - Add portable `createCLI` return type re-exported from `@outfitter/cli/command`
  - Add `--json` output mode for `init`, `add`, and `doctor` commands
  - Route all CLI output through `output()` / `exitWithError()` contract
  - Map `pageSize` prompt option to clack `maxItems`
  - Add `ANSI.inverse` escape code to colors module
  - Add `getSeverityIndicator()` utility

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @outfitter/config@0.2.0
  - @outfitter/contracts@0.2.0
  - @outfitter/types@0.2.0

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

- 2a45c44: Replace custom `wrapText()` implementation with native `Bun.wrapAnsi()` for 33-88x faster ANSI-aware text wrapping
- 4f58c46: Add text utilities (pluralize, slugify), format utilities (formatDuration, formatBytes), parseDateRange, and registerRenderer for custom shape renderers
- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [4f58c46]
- Updated dependencies [7522622]
- Updated dependencies
- Updated dependencies [4f58c46]
  - @outfitter/contracts@0.1.0
  - @outfitter/config@0.1.0
  - @outfitter/types@0.1.0

## 0.1.0-rc.4

### Minor Changes

- Release v0.1.0 - First stable release

  This release graduates from release candidate to stable, consolidating all packages at v0.1.0.

  Key changes in this release cycle:
  - Plugin system with registry for Claude Code integration
  - Tooling CLI with upgrade-bun and pre-push commands
  - Renamed stack package to kit
  - GitHub issue templates and label system

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.3
  - @outfitter/types@0.1.0-rc.4
  - @outfitter/config@0.1.0-rc.4

## 0.1.0-rc.3

### Patch Changes

- 2a45c44: Replace custom `wrapText()` implementation with native `Bun.wrapAnsi()` for 33-88x faster ANSI-aware text wrapping
- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [7522622]
  - @outfitter/config@0.1.0-rc.3
  - @outfitter/types@0.1.0-rc.3

## 0.1.0-rc.2

### Patch Changes

- Add text utilities (pluralize, slugify), format utilities (formatDuration, formatBytes), parseDateRange, and registerRenderer for custom shape renderers
- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2
  - @outfitter/types@0.1.0-rc.2
  - @outfitter/config@0.1.0-rc.2

## 0.1.0

### Minor Changes

- chore: align package versions to 0.1.0

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/types@0.1.0

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-01-22

### Added

- **Output utilities**
  - `output()` - Auto-detecting output with support for human, JSON, and JSONL modes
  - `exitWithError()` - Error formatting with category-based exit codes
  - TTY detection for automatic mode selection
  - `OUTFITTER_OUTPUT_FORMAT` environment variable support

- **Input utilities**
  - `collectIds()` - Multi-format ID collection (space/comma-separated, `@file`, stdin)
  - `expandFileArg()` - `@file` reference expansion with size limits
  - `parseGlob()` - Glob pattern expansion using `Bun.Glob`
  - `parseKeyValue()` - `key=value` pair parsing
  - `parseRange()` - Numeric and date range parsing
  - `parseFilter()` - Filter expression parsing with operators
  - `parseSortSpec()` - Sort specification parsing
  - `normalizeId()` - ID normalization with validation
  - `confirmDestructive()` - Destructive operation confirmation with `--yes` bypass

- **Pagination utilities**
  - `loadCursor()` - Load persisted pagination state
  - `saveCursor()` - Save pagination state to XDG state directory
  - `clearCursor()` - Clear pagination state for `--reset` support

- **Error handling**
  - Exit code mapping from error categories (validation, not_found, permission, etc.)
  - Structured JSON error output for non-TTY environments
  - Human-readable error formatting for TTY environments

- **Type exports**
  - `CLIConfig`, `CommandConfig`, `CommandAction`, `CommandFlags`
  - `OutputMode`, `OutputOptions`
  - `CollectIdsOptions`, `ExpandFileOptions`, `ParseGlobOptions`
  - `PaginationState`, `CursorOptions`
  - `ValidationError`, `CancelledError`

[0.0.1]: https://github.com/outfitter-dev/outfitter/releases/tag/@outfitter/cli@0.0.1

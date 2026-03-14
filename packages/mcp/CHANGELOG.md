# @outfitter/mcp

## 0.5.0

### Minor Changes

- 623fef7: Enhance `defineResourceTemplate()` with Zod schema validation for URI template parameters. When `paramSchema` is provided, URI template variables are validated and coerced before handler invocation — parallel to how `defineTool()` validates input. Add `TypedResourceTemplateDefinition<TParams>` type with typed handler. Backward compatible — existing usage without `paramSchema` works unchanged.
- e5ab5d0: Add `.readOnly(bool)` and `.idempotent(bool)` methods to `CommandBuilder` for declaring safety metadata on commands. When set to `true`, these signals are included in the self-documenting root command tree (JSON mode) under a `metadata` field. In the MCP package, `buildMcpTools()` maps `readOnly` to `readOnlyHint` and `idempotent` to `idempotentHint` in MCP tool annotations via the `ActionMcpSpec` interface. Default is non-read-only, non-idempotent (metadata omitted when not set).
- c21b340: Add MCP progress adapter translating ctx.progress StreamEvent to notifications/progress.

  When an MCP client provides a progressToken in tool call params, ctx.progress is now a
  ProgressCallback (from @outfitter/contracts) that emits `notifications/progress` via the
  MCP SDK for each StreamEvent. Without a progressToken, ctx.progress remains undefined.

  The adapter is a separate module (`progress.ts`) for modularity, parallel to the CLI
  NDJSON adapter in @outfitter/cli.

### Patch Changes

- 56594cb: Add standalone reference project in examples/ demonstrating v0.4-v0.6 integration
- a151534: Document intentional large-file exemptions and remove the remaining package-boundary lint violations that blocked repo verification across the affected runtime packages.
- 2eb44e7: Validate `setLogLevel` inputs before updating the MCP client log threshold.
- cb36241: Land the stacked follow-up fixes across tooling, runtime, and scaffold packages after the repo-shape cleanup.

## 0.4.3

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

## 0.4.2

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).

## 0.4.1

### Patch Changes

- 13b36de: Move `zodToJsonSchema` from `@outfitter/mcp` to `@outfitter/contracts`. MCP re-exports for backward compatibility.

## 0.4.0

### Minor Changes

- d683522: Fix runtime resource/prompt registration, add annotation presets, and improve adaptHandler.
  - **fix**: `createSdkServer` no longer registers unused resource/prompt capabilities (#331)
  - **feat**: Export `wrapToolResult` and `wrapToolError` from transport subpath (#341)
  - **feat**: Add `TOOL_ANNOTATIONS` presets (`readOnly`, `writeIdempotent`, `writeAppend`, `destructive`, `control`) (#342)
  - **feat**: `adaptHandler` now accepts generic error type parameter (#342)
  - **chore**: Convert cross-package deps to peerDependencies (#344)

## 0.3.0

### Minor Changes

- 0c099bc: Add unified environment profiles (`OUTFITTER_ENV`) for cross-package defaults.

  **@outfitter/config:** New `getEnvironment()` and `getEnvironmentDefaults()` for reading environment profiles (development/production/test).

  **@outfitter/mcp:** Add `defaultLogLevel` option to `McpServerOptions` with precedence-based resolution: `OUTFITTER_LOG_LEVEL` > options > environment profile > null. Also adds `sendLogMessage()` for server-to-client log forwarding.

  **@outfitter/logging:** New `resolveLogLevel()` utility with precedence: `OUTFITTER_LOG_LEVEL` > explicit level > environment profile > "info".

  **@outfitter/cli:** New `resolveVerbose()` utility with precedence: `OUTFITTER_VERBOSE` > explicit flag > environment profile > false.

### Patch Changes

- Updated dependencies [0c099bc]
  - @outfitter/config@0.3.0
  - @outfitter/logging@0.3.0

## 0.2.0

### Minor Changes

- Expand MCP spec compliance with resources, prompts, and infrastructure
  - Add `ToolAnnotations` with behavioral hints (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
  - Add resource read handlers with `ResourceContent` types (text and blob variants)
  - Add `ResourceTemplateDefinition` with URI template expansion
  - Add prompt system: `PromptDefinition`, `PromptArgument`, `PromptMessage`, `PromptResult`
  - Add argument completions for prompts and resources
  - Add `McpLogLevel` type with level mapping and `shouldEmitLog()` threshold filter
  - Add content annotations, notifications, and subscription support
  - Add progress reporting

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.2.0
  - @outfitter/logging@0.2.0

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

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [4f58c46]
- Updated dependencies [7522622]
- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/logging@0.1.0

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
  - @outfitter/logging@0.1.0-rc.4

## 0.1.0-rc.3

### Patch Changes

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [7522622]
  - @outfitter/logging@0.1.0-rc.3

## 0.1.0-rc.2

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2
  - @outfitter/logging@0.1.0-rc.2

## 0.1.0

### Minor Changes

- chore: align package versions to 0.1.0

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0
  - @outfitter/logging@0.1.0

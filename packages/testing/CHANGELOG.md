# Changelog

## 0.3.0

### Minor Changes

- 109ba72: Add `testCommand()` and `testTool()` wiring test helpers. `testCommand(cli, args, options?)` wraps `captureCLI()` to execute CLI instances and return captured stdout, stderr, and exitCode without side effects. `testTool(tool, input, options?)` validates input against the tool's Zod schema and invokes the handler with a test context — invalid input returns a ValidationError without calling the handler.
- 847da96: Enhanced testCommand() and testTool() with schema, context, and hints support for v0.5 builder pattern.

  **testCommand() enhancements:**

  - `input` option: Pre-parsed input object auto-converted to CLI args
  - `context` option: Mock context injectable via `getTestContext()` for context factories
  - `json` option: Force JSON output mode for envelope parsing
  - `envelope` field: Parsed `CommandEnvelope` from JSON output for structured assertion
  - Returns `TestCommandResult` (extends `CliTestResult` with `envelope`)

  **testTool() enhancements:**

  - `context` option: Full `HandlerContext` overrides (takes priority over individual cwd/env/requestId)
  - `hints` option: Hint generation function for asserting on MCP hints
  - Returns `TestToolResult` (extends `Result` with `hints`)

  **New exports:**

  - `getTestContext()`: Retrieve injected test context in context factories
  - `TestCommandResult` type
  - `TestToolResult` type

  All changes are backward compatible — existing tests continue to work without modification.

- 565c366: Add generic type parameter to `McpHarness.callTool<T>()` and fix default return type

  The previous return type (`Result<McpToolResponse>`) was incorrect — `callTool` returns the raw handler output, not an MCP-wrapped `McpToolResponse`. The new signature defaults to `Result<unknown>` but accepts a type parameter so callers who know the handler shape can write `harness.callTool<MyOutput>("tool", input)` without unsafe casts.

### Patch Changes

- a151534: Document intentional large-file exemptions and remove the remaining package-boundary lint violations that blocked repo verification across the affected runtime packages.
- Updated dependencies [f4f5cdf]
- Updated dependencies [623fef7]
- Updated dependencies [e5ab5d0]
- Updated dependencies [1359264]
- Updated dependencies [2d9e5fa]
- Updated dependencies [2d9e5fa]
- Updated dependencies [f4f5cdf]
- Updated dependencies [f4f5cdf]
- Updated dependencies [f4f5cdf]
- Updated dependencies [e5ab5d0]
- Updated dependencies [2eadac8]
- Updated dependencies [2d9e5fa]
- Updated dependencies [c21b340]
- Updated dependencies [56594cb]
- Updated dependencies [2eadac8]
- Updated dependencies [e5ab5d0]
- Updated dependencies [1359264]
- Updated dependencies [1359264]
- Updated dependencies [2d9e5fa]
- Updated dependencies [72a1e71]
- Updated dependencies [1359264]
- Updated dependencies [5079ff4]
- Updated dependencies [72a1e71]
- Updated dependencies [7e94389]
- Updated dependencies [c21b340]
- Updated dependencies [f4f5cdf]
- Updated dependencies [a151534]
- Updated dependencies [c21b340]
- Updated dependencies [7e94389]
- Updated dependencies [c21b340]
- Updated dependencies [72a1e71]
- Updated dependencies [cc525da]
- Updated dependencies [2eb44e7]
- Updated dependencies [cb36241]
  - @outfitter/cli@1.0.0
  - @outfitter/mcp@0.5.0
  - @outfitter/contracts@0.5.0

## 0.2.5

### Patch Changes

- debf2e2: Release catch-up for the current stack after a sustained run of merged changes
  across CLI, tooling, runtime packages, and docs workflows.

  This intentionally keeps `outfitter` in the `0.3.x` line for the next stable
  publish while bumping the rest of the actively published `@outfitter/*`
  packages in lockstep.

- Updated dependencies [debf2e2]
  - @outfitter/contracts@0.4.2
  - @outfitter/mcp@0.4.3

## 0.2.4

### Patch Changes

- 9fc51cc: Update devDependencies: Bun 1.3.9, biome 2.4.4, ultracite 7.2.3, bunup 0.16.29, lefthook 2.1.1, turbo 2.8.10. Mechanical interface member sorting from biome's new `useSortedInterfaceMembers` rule (formatting only, no behavior changes).
- Updated dependencies [9fc51cc]
  - @outfitter/contracts@0.4.1
  - @outfitter/mcp@0.4.2

## 0.2.3

### Patch Changes

- Updated dependencies [13b36de]
  - @outfitter/contracts@0.4.0
  - @outfitter/mcp@0.4.1

## 0.2.2

### Patch Changes

- Updated dependencies [d683522]
- Updated dependencies [d683522]
  - @outfitter/contracts@0.3.0
  - @outfitter/mcp@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [0c099bc]
  - @outfitter/mcp@0.3.0

## 0.2.0

### Minor Changes

- Improve type portability and platform compatibility
  - Re-export CLI and MCP testing types for consumer convenience
  - Remove top-level `node:*` imports for non-Node bundler compatibility

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @outfitter/contracts@0.2.0
  - @outfitter/mcp@0.2.0

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
  - @outfitter/mcp@0.1.0

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
  - @outfitter/mcp@0.1.0-rc.4

## 0.1.0-rc.3

### Patch Changes

- 7522622: Fix npm publish to resolve workspace:\* dependencies to actual version numbers
- Updated dependencies [7522622]
  - @outfitter/mcp@0.1.0-rc.3

## 0.1.0-rc.2

### Patch Changes

- Updated dependencies
  - @outfitter/contracts@0.1.0-rc.2
  - @outfitter/mcp@0.1.0-rc.2

## [0.1.0] - 2026-01-23

### Added

- Initial release
- MCP test harness with tool testing
- CLI test helpers
- Fixture loading utilities

### Changed

- Align package versions to 0.1.0

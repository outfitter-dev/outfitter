# @outfitter/mcp

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

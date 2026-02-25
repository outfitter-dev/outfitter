# Outfitter

Skills and workflows for working with @outfitter/\* packages. Patterns, templates, compliance checking, and debugging for the Outfitter Stack.

## Installation

```bash
# Add marketplace
/plugin marketplace add outfitter-dev/outfitter

# Install plugin
/plugin install outfitter@outfitter
```

## Skills

| Skill               | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `outfitter-atlas`   | Complete guide: patterns, templates, architecture, package reference     |
| `outfitter-start`   | Start with Outfitter — scaffold new projects or adopt existing codebases |
| `outfitter-upgrade` | Upgrade @outfitter/\* packages with migration guidance                   |
| `outfitter-check`   | Verify Stack compliance with severity-ranked reports                     |
| `outfitter-issue`   | Report issues to outfitter-dev/outfitter                                 |
| `debug-outfitter`   | Systematic debugging with investigation reports                          |

## Agents

| Agent       | Purpose                                                           |
| ----------- | ----------------------------------------------------------------- |
| `outfitter` | Generalist for all @outfitter/\* work — routes to the right skill |
| `tracker`   | Debug @outfitter/\* issues with evidence-based investigation      |

## Commands

| Command         | Purpose                                     |
| --------------- | ------------------------------------------- |
| `/audit [path]` | Quick compliance audit of file or directory |

## Scripts

| Script                                           | Purpose                                 |
| ------------------------------------------------ | --------------------------------------- |
| `skills/outfitter-start/scripts/setup.sh`        | Initialize Stack adoption plan          |
| `skills/outfitter-issue/scripts/create-issue.ts` | Create GitHub issues for stack feedback |

## Quick Start

### Learn the Stack

```
Tell me about Outfitter Stack patterns
```

The `outfitter-atlas` skill activates automatically.

### Create a Handler

```
Create a handler for fetching user profiles
```

The `outfitter-atlas` skill provides patterns and templates.

### Review Code

```
Audit src/handlers/ for stack compliance
```

Or use the command:

```
/audit src/handlers/
```

### Adopt Outfitter Stack

```
Help me adopt Outfitter Stack patterns
```

The `outfitter-start` skill orchestrates a phased workflow:

1. **Scan** — Detect adoption candidates and generate staged plan
2. **Foundation** — Scaffold infrastructure with `outfitter-atlas`
3. **Convert** — TDD handler conversion with `tdd-fieldguide` + `outfitter-atlas`
4. **Adapters** — Wire CLI/MCP with `outfitter-atlas`
5. **Check** — Verify compliance with `outfitter-check`
6. **Feedback** — Report issues with `outfitter-issue`

## Stack Overview

Outfitter Stack provides transport-agnostic infrastructure:

- **Handler Contract**: Pure functions returning `Result<T, E>`
- **Error Taxonomy**: 10 categories with exit/HTTP code mapping
- **Result Types**: Explicit error handling with `better-result`
- **Validation**: Zod schemas with `createValidator()`

Write handlers once, expose via CLI, MCP, or HTTP.

## Packages

| Package                | Purpose                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `@outfitter/cli`       | Typed CLI runtime with terminal detection, rendering, output contracts, and input parsing             |
| `@outfitter/config`    | XDG-compliant config loading with schema validation for Outfitter                                     |
| `@outfitter/contracts` | Result/Error patterns, error taxonomy, and handler contracts for Outfitter                            |
| `@outfitter/daemon`    | Daemon lifecycle, IPC, and health checks for Outfitter                                                |
| `@outfitter/docs`      | Docs CLI, core assembly primitives, freshness checks, and host adapter for Outfitter docs workflows   |
| `@outfitter/file-ops`  | Workspace detection, secure path handling, and file locking for Outfitter                             |
| `@outfitter/index`     | SQLite FTS5 full-text search indexing for Outfitter                                                   |
| `@outfitter/logging`   | Structured logging via logtape with redaction support for Outfitter                                   |
| `@outfitter/mcp`       | MCP server framework with typed tools for Outfitter                                                   |
| `@outfitter/schema`    | Schema introspection, surface map generation, and drift detection for Outfitter                       |
| `@outfitter/state`     | Pagination cursor persistence and state management for Outfitter                                      |
| `@outfitter/testing`   | Test harnesses, fixtures, and utilities for Outfitter packages                                        |
| `@outfitter/tooling`   | Dev tooling configuration presets for Outfitter projects (oxlint, typescript, lefthook, markdownlint) |
| `@outfitter/tui`       | Terminal UI rendering: tables, lists, boxes, trees, spinners, themes, prompts, and streaming          |
| `@outfitter/types`     | Branded types, type guards, and type utilities for Outfitter                                          |

## Links

- [Outfitter Stack Repository](https://github.com/outfitter-dev/outfitter)
- [Documentation](https://github.com/outfitter-dev/outfitter/tree/main/docs)
- [npm Packages](https://www.npmjs.com/org/outfitter)

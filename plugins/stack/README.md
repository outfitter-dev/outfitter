# Outfitter Stack Plugin

Claude Code plugin for @outfitter/* packages. Provides skills, agents, and commands for building with the Outfitter Stack.

## Installation

```bash
# Add marketplace
/plugin marketplace add outfitter-dev/agents

# Install plugin
/plugin install outfitter-stack@outfitter
```

## Skills

| Skill | Purpose |
|-------|---------|
| `outfitter-stack:outfitter-fieldguide` | Complete guide: patterns, templates, architecture, package reference |
| `outfitter-stack:outfitter-init` | Initialize Stack patterns in any codebase (greenfield or migration) |
| `outfitter-stack:outfitter-check` | Verify Stack compliance with severity-ranked reports |
| `outfitter-stack:outfitter-feedback` | Report issues to outfitter-dev/outfitter |
| `outfitter-stack:debug-outfitter` | Systematic debugging with investigation reports |

## Agents

| Agent | Purpose |
|-------|---------|
| `outfitter-stack:stacker` | Skill-aware generalist for all stack work |
| `outfitter-stack:outfitter-debugger` | Systematic debugger with investigation reports |

## Commands

| Command | Purpose |
|---------|---------|
| `/adopt [path]` | Phased Outfitter Stack adoption workflow |
| `/audit [path]` | Quick compliance audit of file or directory |

## Scripts

| Script | Purpose |
|--------|---------|
| `skills/outfitter-init/scripts/setup.sh` | Initialize Stack adoption plan |
| `skills/outfitter-feedback/scripts/create-issue.ts` | Create GitHub issues for stack feedback |

## Quick Start

### Learn the Stack

```
Tell me about Outfitter Stack patterns
```

The `outfitter-stack:outfitter-fieldguide` skill activates automatically.

### Create a Handler

```
Create a handler for fetching user profiles
```

The `outfitter-stack:outfitter-fieldguide` skill provides patterns and templates.

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
/adopt
```

The `/adopt` command orchestrates a phased workflow:
1. **Init** — Scan and plan with `outfitter-stack:outfitter-init`
2. **Foundation** — Scaffold infrastructure with `outfitter-stack:outfitter-fieldguide`
3. **Convert** — TDD handler conversion with `outfitter:tdd` + `outfitter-stack:outfitter-fieldguide`
4. **Adapters** — Wire CLI/MCP with `outfitter-stack:outfitter-fieldguide`
5. **Check** — Verify compliance with `outfitter-stack:outfitter-check`
6. **Feedback** — Report issues with `outfitter-stack:outfitter-feedback`

## Stack Overview

Outfitter Stack provides transport-agnostic infrastructure:

- **Handler Contract**: Pure functions returning `Result<T, E>`
- **Error Taxonomy**: 10 categories with exit/HTTP code mapping
- **Result Types**: Explicit error handling with `better-result`
- **Validation**: Zod schemas with `createValidator()`

Write handlers once, expose via CLI, MCP, or HTTP.

## Packages

| Package | Purpose |
|---------|---------|
| `@outfitter/contracts` | Result types, errors, Handler contract |
| `@outfitter/cli` | CLI commands with output modes |
| `@outfitter/mcp` | MCP server framework |
| `@outfitter/config` | XDG-compliant configuration |
| `@outfitter/logging` | Structured logging with redaction |
| `@outfitter/daemon` | Background services with IPC |
| `@outfitter/file-ops` | Secure paths, atomic writes |
| `@outfitter/testing` | Test harnesses for CLI/MCP |

## Links

- [Outfitter Stack Repository](https://github.com/outfitter-dev/outfitter)
- [Documentation](https://github.com/outfitter-dev/outfitter/tree/main/docs)
- [npm Packages](https://www.npmjs.com/org/outfitter)

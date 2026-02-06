# Outfitter Stack Plugin

Claude Code plugin for @outfitter/* packages. Provides skills, agents, and commands for building with the Outfitter Stack.

## Installation

```bash
# Add marketplace
/plugin marketplace add outfitter-dev/outfitter

# Install plugin
/plugin install kit@outfitter
```

## Skills

| Skill | Purpose |
|-------|---------|
| `kit:outfitter-fieldguide` | Complete guide: patterns, templates, architecture, package reference |
| `kit:outfitter-init` | Initialize Stack patterns in any codebase (greenfield or migration) |
| `kit:outfitter-check` | Verify Stack compliance with severity-ranked reports |
| `kit:outfitter-feedback` | Report issues to outfitter-dev/outfitter |
| `kit:debug-outfitter` | Systematic debugging with investigation reports |

## Agents

| Agent | Purpose |
|-------|---------|
| `kit:stacker` | Skill-aware generalist for all stack work |
| `kit:outfitter-debugger` | Systematic debugger with investigation reports |

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

The `kit:outfitter-fieldguide` skill activates automatically.

### Create a Handler

```
Create a handler for fetching user profiles
```

The `kit:outfitter-fieldguide` skill provides patterns and templates.

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
1. **Init** — Scan and plan with `kit:outfitter-init`
2. **Foundation** — Scaffold infrastructure with `kit:outfitter-fieldguide`
3. **Convert** — TDD handler conversion with `outfitter:tdd` + `kit:outfitter-fieldguide`
4. **Adapters** — Wire CLI/MCP with `kit:outfitter-fieldguide`
5. **Check** — Verify compliance with `kit:outfitter-check`
6. **Feedback** — Report issues with `kit:outfitter-feedback`

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

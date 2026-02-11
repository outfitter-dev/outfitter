# Outfitter

Skills and workflows for working with @outfitter/* packages. Patterns, templates, compliance checking, and debugging for the Outfitter Stack.

## Installation

```bash
# Add marketplace
/plugin marketplace add outfitter-dev/outfitter

# Install plugin
/plugin install outfitter@outfitter
```

## Skills

| Skill | Purpose |
|-------|---------|
| `outfitter-fieldguide` | Complete guide: patterns, templates, architecture, package reference |
| `outfitter-init` | Initialize Stack patterns in any codebase (greenfield or migration) |
| `outfitter-check` | Verify Stack compliance with severity-ranked reports |
| `outfitter-feedback` | Report issues to outfitter-dev/outfitter |
| `debug-outfitter` | Systematic debugging with investigation reports |

## Agents

| Agent | Purpose |
|-------|---------|
| `stacker` | Skill-aware generalist for all stack work |
| `outfitter-debugger` | Systematic debugger with investigation reports |

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

The `outfitter-fieldguide` skill activates automatically.

### Create a Handler

```
Create a handler for fetching user profiles
```

The `outfitter-fieldguide` skill provides patterns and templates.

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
1. **Init** — Scan and plan with `outfitter-init`
2. **Foundation** — Scaffold infrastructure with `outfitter-fieldguide`
3. **Convert** — TDD handler conversion with `tdd` + `outfitter-fieldguide`
4. **Adapters** — Wire CLI/MCP with `outfitter-fieldguide`
5. **Check** — Verify compliance with `outfitter-check`
6. **Feedback** — Report issues with `outfitter-feedback`

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

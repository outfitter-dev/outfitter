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
| `outfitter-atlas` | Complete guide: patterns, templates, architecture, package reference |
| `outfitter-start` | Start with Outfitter — scaffold new projects or adopt existing codebases |
| `outfitter-update` | Update @outfitter/* packages with migration guidance |
| `outfitter-check` | Verify Stack compliance with severity-ranked reports |
| `outfitter-issue` | Report issues to outfitter-dev/outfitter |
| `debug-outfitter` | Systematic debugging with investigation reports |

## Agents

| Agent | Purpose |
|-------|---------|
| `outfitter` | Generalist for all @outfitter/* work — routes to the right skill |
| `tracker` | Debug @outfitter/* issues with evidence-based investigation |

## Commands

| Command | Purpose |
|---------|---------|
| `/audit [path]` | Quick compliance audit of file or directory |

## Scripts

| Script | Purpose |
|--------|---------|
| `skills/outfitter-start/scripts/setup.sh` | Initialize Stack adoption plan |
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

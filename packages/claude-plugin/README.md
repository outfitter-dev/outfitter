# Outfitter Stack Plugin

Claude Code plugin for @outfitter/* packages. Provides skills, agents, and commands for building with the Outfitter Stack.

## Installation

```bash
# Add marketplace
/plugin marketplace add outfitter-dev/agents

# Install plugin
/plugin install os@outfitter
```

## Skills

| Skill | Purpose |
|-------|---------|
| `os:patterns` | Result types, Handler contract, Error taxonomy reference |
| `os:scaffold` | Create handlers, CLI commands, MCP tools, daemons |
| `os:review` | Audit code for stack compliance |
| `os:migration` | Convert existing code to stack patterns |
| `os:migration-feedback` | Report issues found during migration |
| `os:debug` | Troubleshoot stack-specific issues |
| `os:outfitter-testing` | Test harnesses and patterns |
| `os:outfitter-cli` | Deep CLI patterns (output modes, pagination) |
| `os:outfitter-mcp` | MCP server patterns (tools, resources) |
| `os:outfitter-daemon` | Daemon lifecycle, IPC, health checks |
| `os:outfitter-logging` | Structured logging, sinks, redaction |

## Agents

| Agent | Purpose |
|-------|---------|
| `os:architect` | Design stack-based systems, choose packages |
| `os:implementer` | Build features with TDD methodology |
| `os:reviewer` | Audit code for compliance |

## Commands

| Command | Purpose |
|---------|---------|
| `/os-audit [path]` | Quick compliance audit of file or directory |

## Quick Start

### Learn the Stack

```
Tell me about Outfitter Stack patterns
```

The `os:patterns` skill activates automatically.

### Create a Handler

```
Create a handler for fetching user profiles
```

The `os:scaffold` skill provides templates.

### Review Code

```
Audit src/handlers/ for stack compliance
```

Or use the command:

```
/os-audit src/handlers/
```

### Migrate Existing Code

```
Audit this project for migration to Outfitter Stack
```

The `os:migration` skill runs the scanner and generates:
- `.outfitter/migration/audit-report.md` — Scope and recommendations
- `.outfitter/migration/plan/` — Stage-by-stage task files (foundation, handlers, errors, paths, adapters, documents, unknowns)

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

- [Outfitter Stack Repository](https://github.com/outfitter-dev/stack)
- [Documentation](https://github.com/outfitter-dev/stack/tree/main/docs)
- [npm Packages](https://www.npmjs.com/org/outfitter)

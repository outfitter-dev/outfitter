# Preset Expectations

Per-preset expected files, scripts, and common issues. Use this to calibrate scoring and identify missing elements.

## All Presets (Common)

Every preset should produce:

| File                       | Required | Notes                            |
| -------------------------- | -------- | -------------------------------- |
| `package.json`             | Yes      | Must have name, version, scripts |
| `tsconfig.json`            | Yes      | Should have strict mode enabled  |
| `README.md`                | Yes      | Setup instructions at minimum    |
| `CLAUDE.md` or `AGENTS.md` | Yes      | Agent-readiness documentation    |

Expected scripts in `package.json`:

- `build` (except minimal)
- `test` or `verify:ci`
- `lint` or `check`

## cli

**Purpose**: CLI application using @outfitter/cli with CommandBuilder.

**Expected files**:

- `src/cli.ts` or `src/index.ts` — CLI entry point
- `src/commands/` — Command definitions
- `src/handlers/` or command-colocated handlers

**Expected patterns**:

- CommandBuilder usage (`command().description().action().build()`)
- Handler returning `Result<T, E>`
- `runHandler()` for output envelopes
- Zod schemas for input validation

**Common issues**:

- Missing shebang in CLI entry
- Build script not producing executable output
- Handler not using Result types

## library

**Purpose**: Shared library package with @outfitter/contracts patterns.

**Expected files**:

- `src/index.ts` — Main export barrel
- `src/` — Library source files

**Expected patterns**:

- Clean exports in package.json (`exports` field)
- Result types for public API
- TSDoc on exported functions

**Common issues**:

- Missing `exports` field in package.json
- No type declarations in build output
- Circular dependencies in barrel exports

## full-stack

**Purpose**: Full-stack application with CLI + MCP + handlers.

**Expected files**:

- `src/cli.ts` — CLI entry
- `src/mcp.ts` or `src/server.ts` — MCP server entry
- `src/handlers/` — Shared handler implementations
- `src/actions/` or `src/actions.ts` — Action registry

**Expected patterns**:

- Shared handlers consumed by both CLI and MCP adapters
- Action registry with defineAction()
- Both CLI and MCP surface declarations

**Common issues**:

- MCP server not starting correctly
- Handler shared between surfaces but with surface-specific assumptions
- Missing MCP tool declarations

## minimal

**Purpose**: Bare-bones starting point with minimal dependencies.

**Expected files**:

- `src/index.ts` — Entry point
- `package.json` — Minimal dependencies

**Expected patterns**:

- Very few dependencies
- Basic TypeScript setup
- May not have build script

**Common issues**:

- Too minimal — missing even basic tooling config
- No test infrastructure
- tsconfig missing strict flags

## mcp

**Purpose**: MCP server using @outfitter/mcp.

**Expected files**:

- `src/server.ts` or `src/index.ts` — MCP server entry
- `src/tools/` — Tool definitions
- `src/handlers/` — Handler implementations

**Expected patterns**:

- MCP server setup with typed tools
- defineResource/defineResourceTemplate usage
- Handler pattern with Result types

**Common issues**:

- Server not starting (missing stdio transport setup)
- Tool schemas not matching handler input types
- Missing MCP client test infrastructure

## basic

**Purpose**: Simple starting point with @outfitter/contracts patterns.

**Expected files**:
- `src/index.ts` — Main module with handler
- `src/index.test.ts` — Tests for handler

**Expected patterns**:
- Handler returning `Result<T, E>`
- Zod schemas for input validation
- `createContext()` usage in tests

**Common issues**:
- Missing @outfitter/contracts dependency
- Handler not using Result types
- No error path test coverage

## daemon

**Purpose**: Long-running daemon process using @outfitter/daemon.

**Expected files**:

- `src/daemon.ts` or `src/index.ts` — Daemon entry
- `src/` — Service logic

**Expected patterns**:

- Daemon lifecycle management
- Health check endpoint
- IPC communication setup
- Graceful shutdown handling

**Common issues**:

- Daemon not starting or immediately exiting
- Missing health check endpoint
- No graceful shutdown handling
- PID file management issues

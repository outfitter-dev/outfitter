# Peer Dependencies

`@outfitter/cli` declares six peer dependencies. Three are required for core functionality; three are optional and only needed for specific subpath imports.

## Quick Reference

| Peer                   | Status       | Needed For                                         |
| ---------------------- | ------------ | -------------------------------------------------- |
| `commander`            | **Required** | `createCLI()`, `command()`, all CLI construction   |
| `@outfitter/contracts` | **Required** | `output()`, `exitWithError()`, error taxonomy      |
| `@outfitter/config`    | **Required** | Environment/verbose resolution, terminal detection |
| `@outfitter/schema`    | Optional     | `@outfitter/cli/schema` subpath only               |
| `zod`                  | Optional     | Action input/output schema definitions             |
| `@outfitter/types`     | Optional     | Version alignment only (not directly imported)     |

## Installation

Install the package with all required peers:

```bash
bun add @outfitter/cli commander @outfitter/contracts @outfitter/config
```

Add optional peers as needed:

```bash
# For schema introspection (surface maps, manifest generation)
bun add @outfitter/schema

# For defining actions with Zod schemas (also available transitively via @outfitter/contracts)
bun add zod
```

## Required Peers

### `commander` ≥14.0.0

Commander is the underlying CLI framework. Every CLI-building entry point depends on it.

**Subpaths that import `commander`:**

| Subpath                     | Usage                                            |
| --------------------------- | ------------------------------------------------ |
| `@outfitter/cli/command`    | `createCLI()`, `command()` builder               |
| `@outfitter/cli/actions`    | `buildCliCommands()` action-to-command wiring    |
| `@outfitter/cli/completion` | Shell completion script generation               |
| `@outfitter/cli/schema`     | `createSchemaCommand()` introspection subcommand |
| `@outfitter/cli/types`      | Type-only import for `Command` type              |

### `@outfitter/contracts` ≥0.2.0

Provides the error taxonomy, exit code mapping, and Result-pattern types used throughout the package.

**Subpaths that import `@outfitter/contracts`:**

| Subpath                  | Usage                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `@outfitter/cli`         | Root export — `output()` uses `exitCodeMap`, `safeStringify` |
| `@outfitter/cli/output`  | `exitWithError()` maps `ErrorCategory` to exit codes         |
| `@outfitter/cli/input`   | `ValidationError` for input parsing failures                 |
| `@outfitter/cli/actions` | `ActionRegistry`, `validateInput`, `createContext`           |
| `@outfitter/cli/flags`   | `ActionCliOption` type for preset definitions                |
| `@outfitter/cli/types`   | `ActionCliOption` type re-exports                            |
| `@outfitter/cli/schema`  | `ActionSurface` type                                         |

### `@outfitter/config` ≥0.3.0

Provides environment profile resolution (`OUTFITTER_ENV`) and environment variable helpers.

**Subpaths that import `@outfitter/config`:**

| Subpath                             | Usage                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `@outfitter/cli/output`             | `getEnvironment()`, `getEnvironmentDefaults()` for verbose and output mode resolution |
| `@outfitter/cli/terminal/detection` | `getEnvBoolean()` for color/TTY detection                                             |

Since `output()` is part of the root export (`@outfitter/cli`), this peer is required for basic usage.

## Optional Peers

### `@outfitter/schema` ≥0.1.0

Only needed if you use the `@outfitter/cli/schema` subpath for action introspection, manifest generation, or surface map diffing.

```typescript
// Only this import requires @outfitter/schema
import { createSchemaCommand, generateManifest } from "@outfitter/cli/schema";
```

If you don't use schema introspection, skip this peer entirely.

### `zod` ≥4.0.0

Needed when defining action input/output schemas via `@outfitter/cli/actions`. Action definitions use Zod schemas for validation:

```typescript
import { z } from "zod";
import { defineAction } from "@outfitter/contracts";

const myAction = defineAction({
  id: "my.action",
  input: z.object({ name: z.string() }), // ← requires zod
  output: z.object({ id: z.string() }),
  // ...
});
```

> **Note:** `zod` is a direct dependency of `@outfitter/contracts`, so it is available transitively when `@outfitter/contracts` is installed. The peer dependency listing ensures version alignment across the workspace.

### `@outfitter/types` ≥0.2.0

Not directly imported by any source file in `@outfitter/cli`. Listed as a peer dependency for version alignment across the monorepo. Safe to omit unless another package in your dependency tree requires it.

## Subpath → Peer Dependency Matrix

Which peers are needed for each import path:

| Subpath                             | `commander` | `contracts` | `config` | `schema` | `zod` | `types` |
| ----------------------------------- | :---------: | :---------: | :------: | :------: | :---: | :-----: |
| `@outfitter/cli`                    |             |      ✓      |    ✓     |          |       |         |
| `@outfitter/cli/command`            |      ✓      |             |          |          |       |         |
| `@outfitter/cli/output`             |             |      ✓      |    ✓     |          |       |         |
| `@outfitter/cli/input`              |             |      ✓      |          |          |       |         |
| `@outfitter/cli/flags`              |             |      ✓      |          |          |       |         |
| `@outfitter/cli/query`              |             |             |          |          |       |         |
| `@outfitter/cli/actions`            |      ✓      |      ✓      |          |          |  ✓\*  |         |
| `@outfitter/cli/schema`             |      ✓      |      ✓      |          |    ✓     |       |         |
| `@outfitter/cli/completion`         |      ✓      |             |          |          |       |         |
| `@outfitter/cli/pagination`         |             |             |          |          |       |         |
| `@outfitter/cli/colors`             |             |             |          |          |       |         |
| `@outfitter/cli/text`               |             |             |          |          |       |         |
| `@outfitter/cli/terminal`           |             |             |    ✓     |          |       |         |
| `@outfitter/cli/terminal/detection` |             |             |    ✓     |          |       |         |
| `@outfitter/cli/verbs`              |             |             |          |          |       |         |
| `@outfitter/cli/types`              |      ✓      |      ✓      |          |          |       |         |

\* `zod` is available transitively via `@outfitter/contracts`.

## Peer-Free Subpaths

These subpaths have no peer dependencies and can be used standalone:

- `@outfitter/cli/query` — Output mode and jq presets
- `@outfitter/cli/pagination` — Cursor state persistence
- `@outfitter/cli/colors` — ANSI colors and themes
- `@outfitter/cli/text` — Text measurement, wrapping, truncation
- `@outfitter/cli/verbs` — Verb family definitions

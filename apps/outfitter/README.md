# outfitter

Umbrella CLI for scaffolding Outfitter projects and managing workspace adoption.

## Installation

```bash
bun add -g outfitter
```

Or run directly with `bunx`:

```bash
bunx outfitter --help
```

## Quick Start

```bash
# Scaffold a new CLI project with defaults
bunx outfitter init my-cli --preset cli --yes
cd my-cli
bun install
bun run dev
```

## CLI Overview

```text
outfitter [--json] <command>
```

Global options:

- `--json` - Force JSON output for supported commands

Top-level commands:

- `init [directory]` - Create a new project from scratch (interactive or scripted)
- `scaffold <target> [name]` - Add a new capability to an existing project
- `add <block>` - Add a tooling block (`claude`, `biome`, `lefthook`, `bootstrap`, `scaffolding`)
- `repo <action> <subject>` - Repository maintenance namespace (`check|sync|export`)
- `update` - Check installed `@outfitter/*` versions and optionally show migration guidance
- `doctor` - Validate local environment and project dependencies
- `demo [section]` - Forward to the dedicated demo CLI (`outfitter-demo`)

## Command Reference

### `init`

Create a new project from scratch.

```bash
outfitter init [directory] [options]
outfitter init cli [directory] [options]
outfitter init mcp [directory] [options]
outfitter init daemon [directory] [options]
```

Options:

- `-n, --name <name>` - Package name
- `-b, --bin <name>` - Binary name
- `-p, --preset <preset>` - Preset (`minimal`, `cli`, `mcp`, `daemon`)
- `-t, --template <template>` - Deprecated alias for `--preset`
- `-s, --structure <mode>` - Project structure (`single` | `workspace`)
- `--workspace-name <name>` - Workspace root package name
- `--local` - Use `workspace:*` for `@outfitter/*` dependencies
- `--workspace` - Alias for `--local`
- `--with <blocks>` - Add specific tooling blocks
- `--no-tooling` - Skip tooling setup
- `-f, --force` - Overwrite existing files
- `-y, --yes` - Skip prompts and use defaults
- `--dry-run` - Preview changes without writing files
- `--skip-install` - Skip `bun install`
- `--skip-git` - Skip `git init` and initial commit
- `--skip-commit` - Skip initial commit only

Examples:

```bash
outfitter init my-lib --preset minimal --yes
outfitter init cli my-project --yes
outfitter init my-workspace --preset mcp --structure workspace --workspace-name @acme/root
outfitter init . --template basic --name my-lib
```

### `scaffold`

Add a target capability into an existing project/workspace.

```bash
outfitter scaffold <target> [name] [options]
```

Options:

- `-f, --force` - Overwrite existing files
- `--skip-install` - Skip `bun install`
- `--dry-run` - Preview changes without writing files
- `--with <blocks>` - Add specific tooling blocks
- `--no-tooling` - Skip default tooling blocks
- `--local` - Use `workspace:*` for `@outfitter/*` dependencies

Examples:

```bash
outfitter scaffold mcp
outfitter scaffold lib shared-utils
outfitter scaffold cli admin-console --with biome,lefthook
```

### `add`

Add a tooling block from the registry.

```bash
outfitter add <block> [options]
outfitter add list
```

Options:

- `-f, --force` - Overwrite existing files
- `--dry-run` - Preview without writing files

Examples:

```bash
outfitter add scaffolding
outfitter add biome --dry-run
outfitter add list
```

### `repo`

Canonical namespace for repository maintenance workflows.

```bash
outfitter repo check <subject> [options]
outfitter repo sync <subject> [options]
outfitter repo export <subject> [options]
```

Current subjects:

- `check docs` - Validate generated package docs are up to date
- `sync docs` - Generate package docs into `docs/packages`
- `export docs` - Export package and LLM docs artifacts
- `check exports` - Validate package export maps
- `check readme` - Validate README import examples
- `check registry` - Validate bunup workspace registration
- `check changeset` - Validate required changesets for package changes
- `check tree` - Assert no modified/untracked files
- `check boundary-invocations` - Disallow direct `packages/*/src` execution from root/app scripts

Examples:

```bash
outfitter repo check docs --cwd .
outfitter repo sync docs --cwd .
outfitter repo export docs --target llms
outfitter repo check exports --json
outfitter repo check readme
```

### `upgrade`

Check installed `@outfitter/*` packages against npm versions.

```bash
outfitter upgrade [options]
```

Options:

- `--guide` - Include composed migration guidance
- `--all` - Include breaking changes
- `--dry-run` - Preview without making changes
- `--yes` - Skip interactive prompts
- `--cwd <path>` - Working directory to inspect

Examples:

```bash
outfitter upgrade
outfitter upgrade --guide
outfitter upgrade --json --cwd .
```

### `doctor`

Validate local environment and project structure.

```bash
outfitter doctor
```

### `demo`

Compatibility bridge to the dedicated demo CLI.

```bash
outfitter demo [section] [options]
```

Options:

- `-l, --list` - List available sections
- `-a, --animate` - Run animated spinner demo

Use `outfitter-demo` (or `cli-demo`) directly for the dedicated demo app.

## Command Conventions

Canonical boundary and command conventions are documented in
[`docs/BOUNDARY-CONVENTIONS.md`](../../docs/BOUNDARY-CONVENTIONS.md).

Quick model status:

- `init`, `add`, `check`: implemented user-facing verbs
- `setup`, `fix`, user-facing `docs`: planned convergence verbs
- `repo check|sync|export`: canonical maintenance namespace

## Programmatic API

Root exports:

```typescript
import {
  runDoctor,
  runInit,
  runScaffold,
  type InitOptions,
  type ScaffoldOptions,
} from "outfitter";
```

Command subpath exports:

```typescript
import { runAdd } from "outfitter/commands/add";
import { runUpdate } from "outfitter/commands/update";
```

Example:

```typescript
import { runInit } from "outfitter";

const result = await runInit({
  targetDir: "./my-app",
  preset: "cli",
  force: false,
  yes: true,
});

if (result.isErr()) {
  console.error(result.error.message);
}
```

## Requirements

- Bun >= 1.3.7

## Related Packages

- `@outfitter/cli` - CLI framework primitives
- `@outfitter/contracts` - Result and error contracts
- `@outfitter/mcp` - MCP server framework
- `@outfitter/tooling` - Tooling presets and verification CLI
- `outfitter-cli-demo` - Dedicated CLI/TUI demo app

## License

MIT

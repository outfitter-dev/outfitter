# outfitter

Umbrella CLI for scaffolding Outfitter projects and managing development environments.

## Installation

```bash
bun add -g outfitter
```

Or run directly with `bunx`:

```bash
bunx outfitter init cli my-project
```

## Quick Start

```bash
# Scaffold a new CLI project
outfitter init cli my-cli

# Scaffold a new MCP server
outfitter init mcp my-mcp

# Scaffold a new daemon
outfitter init daemon my-daemon

# Check your environment
outfitter doctor
```

## Commands

### init

Scaffolds a new Outfitter project from a template.

```bash
outfitter init <cli|mcp|daemon> [directory] [options]
outfitter init [directory] --template <template> [options]
```

**Arguments:**
- `directory` - Target directory (defaults to current directory)

**Options:**
- `-n, --name <name>` - Project name (defaults to directory name)
- `-b, --bin <name>` - Binary name (defaults to project name)
- `-t, --template <template>` - Template to use (default: `basic`, used with `outfitter init`)
- `-f, --force` - Overwrite existing files

**Templates:**
| Template | Description |
|----------|-------------|
| `basic` | Minimal TypeScript project structure |
| `cli` | CLI application with Commander.js |
| `mcp` | MCP server with typed tools |
| `daemon` | Background daemon with IPC and health checks |

**Examples:**

```bash
# Create in new directory
outfitter init cli my-project

# Create with specific template
outfitter init mcp my-mcp

# Create in current directory with custom name
outfitter init . --name my-custom-name

# Create with a custom binary name
outfitter init cli my-project --bin my-cli

# Force overwrite existing files
outfitter init my-project --force
```

### doctor

Validates your environment and project dependencies.

```bash
outfitter doctor
```

Performs the following checks:
- **Bun Version** - Ensures Bun >= 1.3.6 is installed
- **package.json** - Validates required fields (name, version)
- **Dependencies** - Checks if node_modules is present and complete
- **tsconfig.json** - Verifies TypeScript configuration exists
- **src/ directory** - Confirms source directory structure

**Example output:**

```
Outfitter Doctor

==================================================
[PASS] Bun Version: 1.3.6 (requires 1.3.6)
[PASS] package.json
       my-project@0.1.0
[PASS] Dependencies
       12 dependencies installed
[PASS] tsconfig.json
[PASS] src/ directory

==================================================
5/5 checks passed
```

## Template Variables

Templates use placeholder syntax for project-specific values:

| Placeholder | Description | Default |
|-------------|-------------|---------|
| `{{name}}` | Project name (legacy) | Directory name |
| `{{projectName}}` | Project name | Directory name |
| `{{binName}}` | Binary name | Project name |
| `{{version}}` | Initial version | `0.1.0` |
| `{{description}}` | Project description | Generic description |

Files ending in `.template` have their extension removed after processing (e.g., `package.json.template` becomes `package.json`).

## Programmatic API

The CLI commands are also available as a programmatic API:

```typescript
import { runInit, runDoctor } from "outfitter";

// Initialize a project programmatically
const initResult = await runInit({
  targetDir: "./my-project",
  name: "my-project",
  template: "cli",
  force: false,
});

if (initResult.isErr()) {
  console.error("Failed:", initResult.error.message);
}

// Run doctor checks programmatically
const doctorResult = await runDoctor({ cwd: process.cwd() });

if (doctorResult.exitCode === 0) {
  console.log("All checks passed!");
} else {
  console.log(`${doctorResult.summary.failed} checks failed`);
}
```

### API Types

```typescript
interface InitOptions {
  readonly targetDir: string;
  readonly name: string | undefined;
  readonly template: string | undefined;
  readonly force: boolean;
}

interface DoctorOptions {
  readonly cwd: string;
}

interface DoctorResult {
  readonly checks: {
    readonly bunVersion: BunVersionCheck;
    readonly packageJson: PackageJsonCheck;
    readonly dependencies: DependenciesCheck;
    readonly configFiles: ConfigFilesCheck;
    readonly directories: DirectoriesCheck;
  };
  readonly summary: DoctorSummary;
  readonly exitCode: number;
}
```

## Requirements

- Bun >= 1.3.6

## Related Packages

- `@outfitter/cli` - CLI framework for building command-line tools
- `@outfitter/mcp` - MCP server framework
- `@outfitter/daemon` - Daemon lifecycle management
- `@outfitter/config` - Configuration loading
- `@outfitter/contracts` - Result types and error patterns

## License

MIT

# @outfitter/agents

Agent scaffolding and bootstrap utilities for AI-ready projects.

## Installation

```bash
bun add @outfitter/agents
```

## Quick Start

Initialize agent documentation in your project:

```typescript
import { initAgentDocs } from "@outfitter/agents";

await initAgentDocs();
```

This creates:
- `AGENTS.md` — Guidelines for AI agents working in your project
- `CLAUDE.md` — Project-level instructions for Claude
- `.claude/CLAUDE.md` — Additional Claude-specific guidance
- `.claude/settings.json` — Claude Code settings
- `.claude/hooks/bootstrap.sh` — Bootstrap hook script

## Features

- **Agent Documentation** — Scaffolds `AGENTS.md` and `CLAUDE.md` templates
- **Bootstrap Tooling** — Ensures core development tools are installed
- **Settings Management** — Merges Claude Code settings without overwriting
- **CI-Friendly** — Quiet mode for automated environments

## API Reference

### initAgentDocs(options)

Initialize agent documentation in a directory.

```typescript
interface InitOptions {
  target?: string;   // Target directory (default: cwd)
  merge?: boolean;   // Merge with existing files (default: false)
  force?: boolean;   // Overwrite existing files (default: false)
  quiet?: boolean;   // Suppress output (default: false)
}

// Basic initialization
await initAgentDocs();

// Initialize in specific directory
await initAgentDocs({ target: "/path/to/project" });

// Merge settings.json with existing
await initAgentDocs({ merge: true });

// Force overwrite all files
await initAgentDocs({ force: true });
```

**Behavior:**
- Without `force` or `merge`, existing files are skipped
- With `merge`, only `settings.json` is merged; other files are skipped
- With `force`, all files are overwritten

### bootstrap(options)

Run development environment bootstrap with optional extensions.

```typescript
interface BootstrapOptions {
  tools?: string[];                  // Additional tools to install
  extend?: () => Promise<void>;      // Project-specific setup
  force?: boolean;                   // Skip checks, run full bootstrap
  quiet?: boolean;                   // Suppress output (for CI)
}

// Basic bootstrap
await bootstrap();

// With additional tools
await bootstrap({
  tools: ["ripgrep", "fd"],
});

// With project extensions
await bootstrap({
  extend: async () => {
    await setupDatabase();
    await seedTestData();
  },
});

// Quiet mode for CI
await bootstrap({ quiet: true });
```

**Core tools installed:**
- `gh` — GitHub CLI
- `gt` — Graphite CLI for stacked PRs
- `markdownlint-cli2` — Markdown linting

**Authentication checks:**
- GitHub CLI (`gh auth status` or `GH_TOKEN`/`GITHUB_TOKEN`)
- Graphite CLI (`gt auth status` or `GT_AUTH_TOKEN`)

### mergeSettings(existing, defaults)

Merge Claude Code settings without losing user customizations.

```typescript
interface SettingsJson {
  mcpServers?: Record<string, unknown>;
  hooks?: Record<string, HookConfig>;
  allowedTools?: string[];
  customInstructions?: string;
  // ... other settings
}

interface HookConfig {
  command: string;
  event: string;
  // ... hook configuration
}

const merged = mergeSettings(existingSettings, defaultSettings);
```

**Merge behavior:**
- Arrays are concatenated and deduplicated
- Objects are recursively merged
- User values take precedence over defaults

## Generated Files

### AGENTS.md

Guidelines for AI agents working in your codebase:

```markdown
# AGENTS.md

Guidelines for AI agents and developers working in this repository.

## Project Overview
[Project description and context]

## Project Structure
[Directory layout and conventions]

## Commands
[Build, test, lint commands]

## Architecture
[Key patterns and decisions]
```

### CLAUDE.md

Project-level instructions for Claude:

```markdown
# CLAUDE.md

This file provides AI agents with project-specific context.

@.claude/CLAUDE.md
@AGENTS.md
```

### .claude/settings.json

Claude Code settings with hooks:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "command": ".claude/hooks/bootstrap.sh",
        "event": "Bash",
        "matcher": "bun install"
      }
    ]
  }
}
```

### .claude/hooks/bootstrap.sh

Bootstrap hook that runs after `bun install`:

```bash
#!/bin/bash
# Runs after bun install to ensure environment is ready
bun run bootstrap 2>/dev/null || true
```

## Usage Patterns

### CI/CD Bootstrap

```typescript
// In CI, run quietly and skip interactive prompts
await bootstrap({ quiet: true, force: true });
```

### Monorepo Setup

```typescript
// Initialize docs at monorepo root
await initAgentDocs({ target: "/path/to/monorepo" });

// Individual packages can extend with their own AGENTS.md
```

### Custom Tool Requirements

```typescript
await bootstrap({
  tools: ["jq", "yq", "fzf"],
  extend: async () => {
    // Project-specific setup after core tools
    console.log("Running database migrations...");
    await runMigrations();
  },
});
```

### Pre-commit Hook Integration

```bash
#!/bin/bash
# .husky/pre-commit or lefthook.yml
bun run -e "import { bootstrap } from '@outfitter/agents'; await bootstrap({ quiet: true })"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GH_TOKEN` | GitHub CLI authentication token |
| `GITHUB_TOKEN` | Alternative GitHub token (fallback) |
| `GT_AUTH_TOKEN` | Graphite CLI authentication token |

## Platform Support

- **macOS**: Uses Homebrew for `gh` and `gt` installation
- **Linux/Windows**: Falls back to npm/bun global installs

## Related Packages

- [@outfitter/cli](../cli/README.md) — CLI framework for building tools
- [@outfitter/config](../config/README.md) — XDG-compliant configuration

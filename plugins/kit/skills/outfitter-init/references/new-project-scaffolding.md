# New Project Scaffolding

Guide for creating new Outfitter Stack projects from scratch.

## When This Applies

- No `package.json` in the current directory
- User wants to start a fresh project
- May have context files (CLAUDE.md, SPEC.md, PLAN.md) describing intent

## Context Detection

Before scaffolding, gather context from any existing files.

### Check for Context Files

```bash
ls CLAUDE.md SPEC.md PLAN.md README.md 2>/dev/null
```

**If context files exist**, read them and look for keywords:
- "CLI", "command-line", "tool" → suggest `cli` template
- "MCP", "server", "tools for AI" → suggest `mcp` template
- "daemon", "background", "service" → suggest `daemon` template
- Otherwise → suggest `basic` template

### Check Git State

```bash
git status --porcelain 2>/dev/null | wc -l
```

**If untracked/modified files exist**, warn about potential overwrites.

## Decision Flow with AskUserQuestion

Always use AskUserQuestion to confirm before running commands.

### Step 1: Template Selection

If context files suggested a template:

```
AskUserQuestion:
  question: "Based on [SPEC.md/CLAUDE.md], this looks like a CLI project. Is that right?"
  header: "Template"
  options:
    - label: "Yes, scaffold as CLI"
      description: "Creates CLI with commands, config loading, and output formatting"
    - label: "No, choose different template"
      description: "I'll show you the other options"
```

If no context or user wants different:

```
AskUserQuestion:
  question: "What type of project are you building?"
  header: "Template"
  options:
    - label: "CLI application"
      description: "Command-line tool with typed commands, config, logging"
    - label: "MCP server"
      description: "Server providing tools for AI agents"
    - label: "Daemon service"
      description: "Background service with CLI control interface"
    - label: "Basic library"
      description: "Simple package with Result types and error handling"
```

### Step 2: Project Name

```
AskUserQuestion:
  question: "What should the package be named?"
  header: "Name"
  options:
    - label: "[directory-name]"
      description: "Use current directory name"
    - label: "@scope/[directory-name]"
      description: "Scoped package (recommended for orgs)"
```

### Step 3: Tooling

```
AskUserQuestion:
  question: "Include standard tooling? (biome, lefthook, claude settings)"
  header: "Tooling"
  options:
    - label: "Yes, add scaffolding (Recommended)"
      description: "Adds biome.json, .lefthook.yml, .claude/settings.json, bootstrap script"
    - label: "No, just the template"
      description: "Only creates the project structure"
```

## CLI Reference

After gathering answers, run the appropriate command:

```bash
# Full scaffolding (default)
outfitter init <template> . --name <name>

# Without tooling
outfitter init <template> . --name <name> --no-tooling

# With specific blocks
outfitter init <template> . --name <name> --with claude,biome
```

### Available Templates

| Template | Creates |
|----------|---------|
| `basic` | Library with src/index.ts, Result types |
| `cli` | CLI app with commands/, config loading, output contract |
| `mcp` | MCP server with typed tools, action registry |
| `daemon` | Daemon + CLI control, IPC, health checks |

### Available Tooling Blocks

| Block | Contents |
|-------|----------|
| `scaffolding` | All blocks below (default) |
| `claude` | `.claude/settings.json`, format-on-stop hook |
| `biome` | `biome.json`, ultracite dependency |
| `lefthook` | `.lefthook.yml`, lefthook dependency |
| `bootstrap` | `scripts/bootstrap.sh` |

## Post-Scaffolding

After running `outfitter init`, report:

1. **Files created** - List the key files
2. **Next steps**:
   ```bash
   bun install
   bun run dev
   ```
3. **Suggest loading fieldguide** for pattern reference

## Examples

### Empty Directory, No Context

```
User: "set up a new project"

Agent: [Checks: no package.json, no context files]
       → AskUserQuestion: "What type of project?"

User: selects "CLI application"

Agent: → AskUserQuestion: "Project name?"

User: "my-awesome-cli"

Agent: → AskUserQuestion: "Include tooling?"

User: "Yes"

Agent: [Runs: outfitter init cli . --name my-awesome-cli]
       → Reports created files
       → Suggests: bun install && bun run dev
```

### Has SPEC.md Mentioning MCP

```
User: "initialize this project"

Agent: [Reads SPEC.md, finds "MCP server that provides..." text]
       → AskUserQuestion: "This looks like an MCP server project. Confirm?"

User: "Yes, scaffold as MCP"

Agent: → AskUserQuestion: "Project name?" (suggests name from SPEC.md)

User: "my-mcp-server"

Agent: [Runs: outfitter init mcp . --name my-mcp-server]
```

### Has PLAN.md with CLI Details

```
User: "set this up"

Agent: [Reads PLAN.md, finds detailed CLI command structure]
       → AskUserQuestion: "PLAN.md describes a CLI with commands X, Y, Z. Scaffold as CLI?"

User: "Yes"

Agent: [Uses info from PLAN.md to inform setup]
       [Runs: outfitter init cli . --name <from-plan>]
```

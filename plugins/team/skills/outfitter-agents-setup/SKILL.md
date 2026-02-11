---
name: outfitter-agents-setup
description: "Documentation patterns for AI agents — AGENTS.md, CLAUDE.md, and agent-readable content. Use when creating agent entry points or structuring .claude/ directories."
metadata:
  version: "1.1.0"
  author: outfitter
  category: documentation
---

# Documentation for Agents

Structure and patterns for documentation that AI agents consume — the files and directories that help Claude, Codex, and other agents understand and work with your project.

For human-facing documentation (READMEs, guides, API docs), load the `outfitter-documentation` skill.

## File Architecture

The recommended setup separates tool-agnostic agent guidelines from tool-specific configuration:

```
project/
├── AGENTS.md              # Canonical agent instructions (tool-agnostic)
├── CLAUDE.md              # Entry point that @-mentions AGENTS.md
└── .claude/
    ├── CLAUDE.md          # Claude-specific instructions
    ├── commands/          # Slash commands
    ├── skills/            # Project-specific skills
    ├── rules/             # Modular rule files
    └── settings.json      # Permissions, MCP servers
```

### Why This Structure?

- **AGENTS.md** works across tools (Claude, Codex, Cursor, etc.)
- **@-mentions** avoid duplication and keep CLAUDE.md minimal
- **.claude/** holds Claude-specific extensions without polluting shared docs
- **Modular rules** allow topic-specific guidance without bloating main files

## AGENTS.md

The canonical source of agent instructions. Tool-agnostic — works for Claude, Codex, and other AI assistants.

**Location**: Project root

**Purpose**: Project context, conventions, and guidelines that any AI agent should follow.

### Structure Template

See [templates/AGENTS.md](templates/AGENTS.md) for the full template.

### What Belongs in AGENTS.md

| Include | Exclude |
|---------|---------|
| Project structure overview | Tool-specific instructions |
| Key commands | Claude task management |
| Architectural patterns | Codex sandbox config |
| Development principles | MCP server setup |
| Code style conventions | IDE settings |
| Testing approach | |
| Git workflow | |

### Length Guidelines

- **Target**: 100-300 lines
- **Maximum**: 500 lines
- **Principle**: Comprehensive but scannable — agents should find what they need quickly

## CLAUDE.md (Root)

Minimal entry point that @-mentions other files. Claude Code reads this first.

**Location**: Project root

**Purpose**: Bootstrap Claude's context by pointing to the right files.

### Recommended Pattern

See [templates/CLAUDE-ROOT.md](templates/CLAUDE-ROOT.md) for the template. Keep the root CLAUDE.md minimal.

### Why @-mentions Over Symlinks?

Previously, some projects used symlinks between CLAUDE.md and AGENTS.md. **Don't do this.**

Problems with symlinks:
- Git treats them inconsistently across platforms
- Some tools don't follow symlinks
- Confusing when editing — which file is canonical?
- Breaks when repo is cloned to paths with different structures

The @-mention pattern is explicit, portable, and clear about which file is authoritative.

## .claude/CLAUDE.md

Claude-specific instructions that don't apply to other tools.

**Location**: `.claude/CLAUDE.md`

**Purpose**: Claude Code features, task management, tool-specific guidance.

### Example Content

See [templates/CLAUDE-DOTCLAUDE.md](templates/CLAUDE-DOTCLAUDE.md) for an example.

### What Belongs in .claude/CLAUDE.md

| Include | Exclude |
|---------|---------|
| Task management patterns | Project architecture |
| Claude-specific tool preferences | Code style (goes in AGENTS.md) |
| MCP server usage | Testing approach |
| Subagent coordination | Git workflow |

## .claude/rules/

Modular, topic-specific rule files. Auto-loaded into Claude's context.

**Location**: `.claude/rules/*.md`

**Purpose**: Focused guidance on specific topics — language conventions, testing patterns, API standards.

### When to Use Rules Files

Use `.claude/rules/` for:
- Language-specific guidelines (TYPESCRIPT.md, RUST.md)
- Testing conventions (TESTING.md)
- API standards (API.md)
- Security requirements (SECURITY.md)

### Paths Frontmatter

Rules can be scoped to specific file patterns:

```markdown
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Conventions

Use strict mode. Avoid `any`. Prefer `unknown` for truly unknown types.
```

This rule only loads when working with TypeScript files.

### Codex Compatibility Note

Codex CLI doesn't support `.claude/rules/` or `paths` frontmatter. Keep critical conventions in AGENTS.md to ensure all tools see them.

**Guidance**: Use rules files sparingly. If a convention matters for all agents, put it in AGENTS.md. Reserve rules files for Claude-specific enhancements that won't break the experience for other tools.

## Directory Structure: .claude/

```
.claude/
├── CLAUDE.md           # Claude-specific instructions
├── commands/           # Slash commands
│   ├── build.md
│   ├── test.md
│   └── deploy.md
├── skills/             # Project-specific skills
│   └── local-skill/
│       └── SKILL.md
├── rules/              # Modular rule files
│   ├── TYPESCRIPT.md
│   ├── TESTING.md
│   └── SECURITY.md
├── hooks/              # Event hooks
│   └── hooks.json
└── settings.json       # Permissions, MCP servers
```

| Directory | Purpose |
|-----------|---------|
| `commands/` | User-invocable slash commands (`/build`, `/test`) |
| `skills/` | Project-specific skills loaded on activation |
| `rules/` | Topic-specific convention files |
| `hooks/` | Event handlers for tool calls and lifecycle |

## Writing for Agent Consumption

When writing content that agents will parse:

### Structure for Machines

```markdown
## Good: Explicit structure

| Command | Description |
|---------|-------------|
| `bun test` | Run tests |
| `bun build` | Build project |

## Bad: Prose-heavy

To run tests, you can use the bun test command. For building,
there's bun build which will compile everything.
```

### Be Explicit About Types

```markdown
## Good: Type information clear

The `timeout` option accepts a `number` in milliseconds.
Default: `30000`. Range: `1000-300000`.

## Bad: Ambiguous

Set timeout to control how long operations wait.
```

### Document Error Conditions

```markdown
## Good: Errors are first-class

| Error | Cause | Resolution |
|-------|-------|------------|
| `CONFIG_NOT_FOUND` | Missing config file | Run `init` first |
| `INVALID_FORMAT` | Malformed input | Check input schema |

## Bad: Errors as afterthought

This might fail if config is missing.
```

### Avoid Ambiguous Pronouns

```markdown
## Good: Specific nouns

The `UserService` validates input. The service returns
a `Result<User, ValidationError>`.

## Bad: Ambiguous "it"

The service validates input. It returns a result if it succeeds.
```

### Tables Over Prose

Agents parse tables more reliably than paragraphs.

### Explicit Over Implicit

State conventions directly. Don't assume agents will infer them.

### Concision Over Grammar

Sacrifice grammar for concision. Agents parse tokens, not prose. "Use strict mode" beats "You should always make sure to use strict mode."

## Workflow

When this skill is activated, assess the current state and present options to the user using `AskUserQuestion`:

```text
1. Scan for existing AGENTS.md, CLAUDE.md, .claude/ structure
2. Compare against recommended patterns
3. Present options via AskUserQuestion tool:
   - Audit: Review current docs against patterns
   - Restructure: Reorganize to match recommended structure
   - Enhance: Keep structure, improve content
   - Create: Build missing components from scratch
4. Execute chosen action
5. Validate result against guidelines
```

**Always use AskUserQuestion** when the user needs to choose between approaches. Don't list options in prose — use the tool for interactive decisions.

## Guidelines

When creating or reviewing agent-facing documentation:

- **ALWAYS** create AGENTS.md with tool-agnostic guidelines at project root
- **ALWAYS** use @-mentions in root CLAUDE.md to reference other files
- **ALWAYS** keep .claude/CLAUDE.md focused on Claude-specific content only
- **ALWAYS** structure content for quick scanning — tables over prose
- **ALWAYS** state conventions explicitly — agents don't infer
- **NEVER** use symlinks between CLAUDE.md and AGENTS.md
- **NEVER** put critical conventions only in .claude/rules/ — Codex won't see them
- **NEVER** duplicate content across files — link instead

## References

- [templates/](templates/) — AGENTS.md, CLAUDE.md root, and .claude/CLAUDE.md templates
- [MIGRATION.md](references/MIGRATION.md) — Migrate existing setups to the recommended pattern

---
name: claude-craft
description: "Claude Code extensibility — agents, commands, hooks, skills, rules, and configuration. Use when creating, configuring, or troubleshooting Claude Code components, or when agent.md, /command, hooks.json, SKILL.md, .claude/rules, settings.json, MCP server, PreToolUse, or create agent/command/hook are mentioned."
metadata:
  version: "1.0.2"
  related-skills:
    - skillcraft
    - claude-plugins
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, TaskCreate, TaskUpdate, TaskList, TaskGet
---

# Claude Code Extensibility

Create and configure the six Claude Code extension points: agents, commands, hooks, skills, rules, and configuration.

## Component Map

| Component | Purpose | Location | Invocation |
|-----------|---------|----------|------------|
| **Agents** | Specialized subagents | `agents/*.md` | Task tool (`subagent_type`) |
| **Commands** | Reusable prompts | `commands/*.md` | User: `/command-name` |
| **Hooks** | Event handlers | `settings.json` or `hooks/hooks.json` | Automatic on events |
| **Skills** | Capability packages | `skills/*/SKILL.md` | Auto-triggered by context |
| **Rules** | Convention files | `.claude/rules/*.md` | Loaded on demand |
| **Config** | Settings & MCP | `settings.json`, `.mcp.json` | Loaded at startup |

### Scope Hierarchy

| Scope | Location | Visibility |
|-------|----------|------------|
| Personal | `~/.claude/` | You only |
| Project | `.claude/` or root | Team via git |
| Plugin | `<plugin>/` | Plugin users |

## Routing

| Task | Use |
|------|-----|
| Creating agents, commands, hooks, rules, config | This skill |
| Creating skills (Claude-specific features) | This skill + `skillcraft` for base spec |
| Creating skills (cross-platform spec) | `skillcraft` |
| Packaging/distributing plugins | `claude-plugins` |

---

## Agents

Specialized subagents with focused expertise, invoked via the Task tool.

### Frontmatter

```yaml
---
name: security-reviewer       # Required: kebab-case, matches filename
description: |                 # Required: triggers + examples
  Use this agent for security vulnerability detection.
  Triggers on security audits, OWASP, injection, XSS.

  <example>
  Context: User wants security review.
  user: "Review auth code for vulnerabilities"
  assistant: "I'll use the security-reviewer agent."
  </example>
model: inherit                 # Optional: inherit(default)|haiku|sonnet|opus
tools: Glob, Grep, Read       # Optional: comma-separated (default: inherit all)
disallowedTools: Write, Edit   # Optional: deny specific tools
skills: tdd-fieldguide, debugging  # Optional: auto-load skills (NOT inherited)
maxTurns: 50                   # Optional: max agentic turns
memory: user                   # Optional: user|project|local — persistent memory
hooks:                         # Optional: lifecycle hooks scoped to this agent
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
---
```

See [agents/frontmatter.md](references/agents/frontmatter.md) for complete schema.

### Archetypes

| Type | Purpose | Typical Tools |
|------|---------|---------------|
| **Analyzer** | Examine without modifying | `Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet` |
| **Implementer** | Build and modify code | Full access (inherit) |
| **Reviewer** | Provide feedback | Read-only + Skill + Task tools |
| **Tester** | Create and manage tests | Read, Write, Edit, Bash, ... |
| **Researcher** | Find and synthesize info | ..., WebSearch, WebFetch |

See [agents/types.md](references/agents/types.md) for details.

### Model Selection

| Model | When to Use |
|-------|-------------|
| `inherit` | Recommended default — adapts to parent context |
| `haiku` | Fast exploration, simple tasks, low-latency |
| `sonnet` | Balanced cost/capability (default if omitted) |
| `opus` | Nuanced judgment, security/architecture review |

### Tool Configuration

**Baseline** (always include when restricting):

```yaml
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet
```

Only restrict tools when there's a specific safety reason. See [agents/tools.md](references/agents/tools.md).

### Agent Body Structure

```markdown
# Agent Name

You are a [role] specializing in [expertise].

## Process

### Step 1: [Stage]
- Action items

## Output Format

Structured output spec.

## Constraints

**Always:** Required behaviors
**Never:** Prohibited actions
```

### Validation Checklist

- [ ] `name` matches filename (kebab-case, 1-3 words)
- [ ] `description` has WHAT, WHEN, triggers, 2-3 examples
- [ ] `tools` uses comma-separated valid names (case-sensitive)
- [ ] Body has clear role, process, output format, constraints

### References

| Reference | Content |
|-----------|---------|
| [agents/frontmatter.md](references/agents/frontmatter.md) | YAML schema and fields |
| [agents/types.md](references/agents/types.md) | Archetypes and patterns |
| [agents/tools.md](references/agents/tools.md) | Tool configuration patterns |
| [agents/discovery.md](references/agents/discovery.md) | How agents are found and loaded |
| [agents/patterns.md](references/agents/patterns.md) | Best practices, multi-agent patterns |
| [agents/tasks.md](references/agents/tasks.md) | Task tool patterns |
| [agents/task-tool.md](references/agents/task-tool.md) | Task tool integration |
| [agents/performance.md](references/agents/performance.md) | Performance optimization |
| [agents/advanced-features.md](references/agents/advanced-features.md) | Resumable agents, CLI config |
| [agents/agent-vs-skill.md](references/agents/agent-vs-skill.md) | Agents vs Skills distinction |

---

## Commands

Custom slash commands — reusable prompts invoked by users.

### Frontmatter

```yaml
---
description: Deploy to environment with validation   # Required
argument-hint: <environment> [--skip-tests]          # Shown in autocomplete
allowed-tools: Bash(*), Read                          # Restrict tool access
model: claude-3-5-haiku-20241022                     # Override model
---
```

See [commands/frontmatter.md](references/commands/frontmatter.md) for complete schema.

### Core Features

<!-- <bang> = exclamation mark; used as stand-in to avoid triggering preprocessing -->

| Feature | Syntax | Purpose |
|---------|--------|---------|
| Arguments | `$1`, `$2`, `$ARGUMENTS` | Dynamic input from user |
| Bash execution | `` <bang>`command` `` | Include shell output in context |
| File references | `@path/to/file` | Include file contents |
| Tool restrictions | `allowed-tools:` | Limit Claude's capabilities |

### Quick Example

```markdown
---
description: Fix a specific GitHub issue
argument-hint: <issue-number>
---

Fix issue #$1 following our coding standards.
Review the issue, implement a fix, add tests, and create a commit.
```

Usage: `/fix-issue 123`

### Argument Patterns

- **Positional**: `$1`, `$2`, `$3` — `/compare old.ts new.ts`
- **All arguments**: `$ARGUMENTS` — `/fix memory leak in auth`
- **With file refs**: `@$1` — `/analyze src/main.ts`

See [commands/arguments.md](references/commands/arguments.md) for advanced patterns.

### Scopes

| Scope | Location | Shows in /help |
|-------|----------|----------------|
| Project | `.claude/commands/` | "(project)" |
| Personal | `~/.claude/commands/` | "(user)" |
| Plugin | `<plugin>/commands/` | Plugin name |

Subdirectories create namespaces: `commands/frontend/component.md` → `/component`.

### Validation Checklist

- [ ] Filename is kebab-case `.md` (verb-noun pattern preferred)
- [ ] `description` is action-oriented, under 80 chars
- [ ] `argument-hint` uses `<required>` and `[optional]` syntax
- [ ] `allowed-tools` uses correct case-sensitive names
- [ ] Bash commands tested in terminal first

### References

| Reference | Content |
|-----------|---------|
| [commands/frontmatter.md](references/commands/frontmatter.md) | Complete frontmatter schema |
| [commands/arguments.md](references/commands/arguments.md) | Argument handling patterns |
| [commands/bash-execution.md](references/commands/bash-execution.md) | Shell command execution |
| [commands/file-references.md](references/commands/file-references.md) | File inclusion syntax |
| [commands/permissions.md](references/commands/permissions.md) | Tool restriction patterns |
| [commands/namespacing.md](references/commands/namespacing.md) | Directory organization |
| [commands/sdk-integration.md](references/commands/sdk-integration.md) | Agent SDK usage |
| [commands/community.md](references/commands/community.md) | Community examples |

---

## Hooks

Event handlers that automate workflows, validate operations, and respond to Claude Code events.

### Hook Types

| Type | Best For | Response Format | Default Timeout |
|------|----------|-----------------|-----------------|
| **command** | Deterministic checks, external tools | Exit codes + JSON | 600s |
| **prompt** | Complex reasoning, context-aware validation | `{"ok": bool, "reason": "..."}` | 30s |
| **agent** | Multi-step verification requiring tool access | `{"ok": bool, "reason": "..."}` (up to 50 turns) | 60s |

**Prompt hooks**: Send prompt + hook input to a Claude model (Haiku by default, override with `model` field). Return `{"ok": true}` to proceed or `{"ok": false, "reason": "..."}` to block.

**Agent hooks**: Spawn a subagent with tool access (`allowedTools`) for multi-step verification. Same `ok`/`reason` response format as prompt hooks.

### Events

| Event | When | Can Block | Matcher | Common Uses |
|-------|------|-----------|---------|-------------|
| **PreToolUse** | Before tool executes | Yes | Tool name | Validate commands, check paths |
| **PostToolUse** | After tool succeeds | No | Tool name | Auto-format, run linters |
| **PostToolUseFailure** | After tool fails | No | Tool name | Error logging, retry logic |
| **PermissionRequest** | Permission dialog shown | Yes | Tool name | Auto-allow/deny rules |
| **UserPromptSubmit** | User submits prompt | No | (none) | Add context, log activity |
| **Notification** | Claude sends notification | No | Notification type | External alerts, desktop notify |
| **Stop** | Claude finishes responding | No | (none) | Cleanup, verify completion |
| **SubagentStart** | Subagent spawns | No | Agent type | Track spawning, setup resources |
| **SubagentStop** | Subagent finishes | No | Agent type | Log results, trigger follow-ups |
| **TeammateIdle** | Team agent about to idle | No | (none) | Coordination, reassignment |
| **TaskCompleted** | Task marked completed | No | (none) | Validation, notifications |
| **Setup** | `--init` or `--maintenance` | No | (none) | Initialize environment |
| **PreCompact** | Before context compaction | No | Trigger type | Backup conversation |
| **SessionStart** | Session starts/resumes | No | Start reason | Load context, show status |
| **SessionEnd** | Session ends | No | End reason | Cleanup, save state |

See [hooks/hook-types.md](references/hooks/hook-types.md) for detailed per-event documentation.

### Configuration Format

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit(*.ts|*.tsx)",
        "hooks": [
          {
            "type": "command",
            "command": "biome check --write \"$file\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

| Location | Scope | Format |
|----------|-------|--------|
| `.claude/settings.json` | Project (shared) | Direct `"hooks"` key |
| `.claude/settings.local.json` | Project (local) | Direct `"hooks"` key |
| `~/.claude/settings.json` | Personal | Direct `"hooks"` key |
| `<plugin>/hooks/hooks.json` | Plugin | Wrapped in `{"description": "...", "hooks": {...}}` |

### Matchers

```json
{"matcher": "Write"}                    // Exact match
{"matcher": "Edit|Write"}               // Multiple tools (OR)
{"matcher": "*"}                        // All tools
{"matcher": "Write(*.py)"}              // File pattern
{"matcher": "Write|Edit(*.ts|*.tsx)"}   // Multiple + pattern
{"matcher": "mcp__memory__.*"}          // MCP server tools
```

Lifecycle event matchers:
- **SessionStart**: `startup`, `resume`, `clear`, `compact`
- **SessionEnd**: `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other`
- **Notification**: `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`
- **SubagentStart/Stop**: Agent type name (e.g., `Explore`, `Plan`, `db-agent`)
- **PreCompact**: `manual`, `auto`

See [hooks/matchers.md](references/hooks/matchers.md) for advanced patterns.

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success, continue execution |
| `2` | Block operation (PreToolUse only), stderr shown to Claude |
| Other | Warning, stderr shown to user, continues |

### JSON Output (Advanced)

```json
{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "Context for Claude",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Explanation",
    "updatedInput": {"modified": "field"}
  }
}
```

### Execution Model

All matching hooks run **in parallel** (not sequentially). Identical handlers are automatically deduplicated. Design hooks to be independent — they cannot see each other's output.

**Hot-swap**: Hooks added via `/hooks` menu take effect immediately. Manual edits to settings files require a session restart or `/hooks` menu visit.

**Stop hooks**: Fire whenever Claude finishes responding, not only at task completion. Do NOT fire on user interrupts. To prevent infinite loops, check `stop_hook_active` in the input JSON and exit early if `true`.

### Component-Scoped Hooks

Skills, agents, and commands can define hooks in frontmatter. All hook events are supported. `Stop` hooks in agent/skill frontmatter are automatically converted to `SubagentStop` events at runtime.

```yaml
---
name: my-skill
hooks:
  PreToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: prompt
          prompt: "Validate this write operation..."
  Stop:  # Converted to SubagentStop at runtime
    - hooks:
        - type: command
          command: "./scripts/on-complete.sh"
---
```

### Environment Variables

| Variable | Availability | Description |
|----------|--------------|-------------|
| `$CLAUDE_PROJECT_DIR` | All hooks | Project root directory |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin hooks | Plugin root (use for portable paths) |
| `$file` | PostToolUse (Write/Edit) | Path to affected file |
| `$CLAUDE_ENV_FILE` | SessionStart | Write env vars to persist for session |
| `$CLAUDE_CODE_REMOTE` | All hooks | Set if running in remote context |

### Validation Checklist

- [ ] Hook scripts are executable (`chmod +x`)
- [ ] Matchers use correct case-sensitive tool names
- [ ] Timeouts set (default: 600s command, 30s prompt, 60s agent; max: 10 minutes)
- [ ] Scripts use `set -euo pipefail` and quote variables
- [ ] Plugin hooks use `${CLAUDE_PLUGIN_ROOT}` for paths

### References

| Reference | Content |
|-----------|---------|
| [hooks/hook-types.md](references/hooks/hook-types.md) | Per-event documentation |
| [hooks/matchers.md](references/hooks/matchers.md) | Advanced matcher patterns |
| [hooks/schema.md](references/hooks/schema.md) | Complete configuration schema |
| [hooks/security.md](references/hooks/security.md) | Security best practices |
| [hooks/examples.md](references/hooks/examples.md) | Real-world implementations |

---

## Skills (Claude-Specific)

Claude Code extends the base [Agent Skills specification](https://agentskills.io/specification) with additional features. For the cross-platform spec, load `skillcraft`.

### Frontmatter Extensions

| Field | Type | Description |
|-------|------|-------------|
| `allowed-tools` | string | Space-separated tools that run without permission prompts |
| `user-invocable` | boolean | Default `true`. Set `false` to prevent `/skill-name` access |
| `disable-model-invocation` | boolean | Prevents auto-activation; requires manual Skill tool |
| `context` | string | `inherit` (default) or `fork` for isolated subagent execution |
| `agent` | string | Agent for `context: fork` (e.g., `Explore`, `analyst`) |
| `model` | string | Override model: `haiku`, `sonnet`, or `opus` |
| `hooks` | object | Lifecycle hooks active while skill loaded |
| `argument-hint` | string | Hint shown after `/skill-name` (e.g., `[file path]`) |

### Tool Restrictions

```yaml
# Space-separated list
allowed-tools: Read Grep Glob

# With Bash patterns
allowed-tools: Read Write Bash(git *) Bash(npm run *)

# MCP tools (double underscore format)
allowed-tools: Read mcp__linear__create_issue
```

Tool names are case-sensitive. See [skills/integration.md](references/skills/integration.md) for patterns.

### String Substitutions

| Pattern | Replaced With |
|---------|---------------|
| `$ARGUMENTS` | User input after `/skill-name` |
| `${CLAUDE_SESSION_ID}` | Current session identifier |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin root directory path |

### Context Modes

- **`inherit`** (default): Runs in main conversation with full history access
- **`fork`**: Runs in isolated subagent context; prevents context pollution

```yaml
context: fork
agent: analyst
model: haiku
```

See [skills/context-modes.md](references/skills/context-modes.md) for patterns.

### References

| Reference | Content |
|-----------|---------|
| [skills/context-modes.md](references/skills/context-modes.md) | Fork vs inherit patterns |
| [skills/integration.md](references/skills/integration.md) | Commands, hooks, MCP integration |
| [skills/performance.md](references/skills/performance.md) | Token impact, optimization |
| [skills/preprocessing-safety.md](references/skills/preprocessing-safety.md) | Safe preprocessing patterns |

---

## Preprocessing

<!-- <bang> = exclamation mark; used as stand-in to avoid triggering preprocessing -->

Claude Code preprocesses `` <bang>`command` `` syntax — executing shell commands and injecting output before content reaches Claude. This powers live context in commands (git state, PR details, environment info).

**Critical**: Preprocessing runs in both command files AND SKILL.md files, including inside markdown code fences. There is no escape mechanism.

### Where preprocessing runs

| Context | Preprocessed | Safe to use literal ``!``? |
|---------|-------------|--------------------------|
| Command files (`commands/*.md`) | Yes | Yes — intentional |
| SKILL.md | Yes | No — use `` <bang> `` instead |
| References, EXAMPLES.md | No | Yes — great for copy-paste demos |
| Rules, CLAUDE.md, agents | No | Yes |

### Writing SKILL.md files

When documenting or referencing the preprocessing syntax in a SKILL.md, use `` <bang> `` as a stand-in for ``!``. Agents interpret `` <bang> `` as ``!``.

Add an HTML comment explaining the convention:

```html
<!-- <bang> = exclamation mark; used as stand-in to avoid triggering preprocessing -->
```

Then use `` <bang> `` for any inline references:

- `` <bang>`git status` `` — injects current git status
- `` <bang>`gh pr view --json title` `` — injects PR details

Move real copy-paste examples with literal ``!`` to reference files — those are not preprocessed.

### Writing reference files

Reference files (`references/`, `EXAMPLES.md`) are not preprocessed. Use literal ``!`` freely — these serve as copy-paste sources for command authors:

See [commands/bash-execution.md](references/commands/bash-execution.md) for the full reference with real ``!`` syntax.

### Intentional preprocessing in skills

Skills that genuinely run commands at load time should declare it in frontmatter:

```yaml
metadata:
  preprocess: true
```

### Validation

Run `/skillcheck` to scan SKILL.md files for unintentional preprocessing patterns. The linter respects `metadata.preprocess: true` and skips intentional uses.

See [skills/preprocessing-safety.md](references/skills/preprocessing-safety.md) for detailed examples, common mistakes, and the full convention.

---

## Rules

Reusable convention files in `.claude/rules/` for project patterns.

### Rules vs CLAUDE.md

| Aspect | CLAUDE.md | .claude/rules/ |
|--------|-----------|----------------|
| Loading | Automatic at session start | On-demand via reference |
| Content | Project setup, key commands | Reusable conventions |
| Size | Concise (~200-500 lines) | Can be detailed |

**CLAUDE.md**: One-off instructions, project commands, key file locations.
**rules/**: Formatting conventions, architecture patterns, workflow guidelines.

### File Conventions

- **UPPERCASE.md** — All caps with `.md` extension
- **Topic-focused** — One concern per file
- **Kebab-case** for multi-word: `API-PATTERNS.md`, `CODE-REVIEW.md`

### Path-Specific Rules

```yaml
---
paths:
  - "src/api/**/*.ts"
  - "lib/**/*.ts"
---

# API Development Rules
```

### Referencing Rules

Rules are NOT auto-loaded. Reference from CLAUDE.md:

```markdown
# CLAUDE.md
Follow `.claude/rules/FORMATTING.md` for all code conventions.
```

Or use `@` syntax: `@./project-specific/FORMATTING.md`

See [rules.md](references/rules.md) for detailed patterns and anti-patterns.

---

## Configuration

### File Locations

| Scope | Settings | MCP |
|-------|----------|-----|
| Personal | `~/.claude/settings.json` | `~/.claude.json` |
| Project (shared) | `.claude/settings.json` | `.mcp.json` |
| Project (local) | `.claude/settings.local.json` | — |
| Managed (org) | System-level path | — |

Precedence (highest first): Managed > CLI args > Local > Project > User.

### MCP Server Setup

**Project MCP** (`.mcp.json`):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {"GITHUB_TOKEN": "${GITHUB_TOKEN}"}
    }
  }
}
```

**Personal MCP** (`~/.claude.json`):

```json
{
  "mcp_servers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

### Key Settings

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": ["Bash(npm run lint)"],
    "deny": ["Read(./.env)"],
    "defaultMode": "acceptEdits"
  },
  "hooks": {},
  "enabledPlugins": {"plugin@marketplace": true},
  "model": "claude-sonnet-4-5-20250929"
}
```

See [config/mcp-patterns.md](references/config/mcp-patterns.md), [config/workflows.md](references/config/workflows.md), and [config/troubleshooting.md](references/config/troubleshooting.md) for details.

---

## Testing & Debugging

```bash
# Debug mode — shows skill/agent/hook loading details
claude --debug

# Force reload after changes
/clear

# Test hook manually
echo '{"tool_name": "Write", "tool_input": {"file_path": "test.ts"}}' | ./hooks/my-hook.sh

# Verify commands appear
/help
```

---

## External Resources

- [Claude Code Docs — Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Docs — Memory](https://code.claude.com/docs/en/memory)
- [Claude Code Docs — Settings](https://code.claude.com/docs/en/settings)
- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Agent Skills Spec](https://agentskills.io/specification)

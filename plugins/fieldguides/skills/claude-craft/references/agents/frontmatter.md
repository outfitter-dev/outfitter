# Agent Frontmatter

YAML frontmatter schema for agent files.

## Required Fields

### `name`

Agent identifier. Should match filename without `.md`.

```yaml
name: security-reviewer
```

### `description`

When to use + trigger keywords + examples. Most critical field for discovery.

**Format:**

```yaml
description: |
  Use this agent when [trigger conditions]. Triggers on [keywords].

  <example>
  Context: [Situation]
  user: "[User message]"
  assistant: "[Claude's delegation response]"
  </example>
```

**Checklist:**
- Starts with "Use this agent when..."
- Includes 3-5 trigger keywords
- Has 3-4 examples covering: typical use, edge case, verb triggers
- Specific, not vague

**Example:**

```yaml
description: |
  Use this agent for security vulnerability detection in code.
  Triggers on security audits, OWASP, injection, XSS, auth review.

  <example>
  Context: User wants security review.
  user: "Review this auth code for vulnerabilities"
  assistant: "I'll use the security-reviewer agent to analyze for security issues."
  </example>

  <example>
  Context: User mentions specific vulnerability type.
  user: "Check for SQL injection in the user service"
  assistant: "I'll delegate to the security-reviewer agent for SQL injection analysis."
  </example>
```

## Optional Fields

### `model`

Controls which model the subagent uses. Three strategies:

| Strategy | Syntax | Behavior |
|----------|--------|----------|
| **Omit entirely** | _(no `model` field)_ | Inherits parent's model. Same as `inherit`. |
| **Explicit inherit** | `model: inherit` | Inherits parent's model. Use when you want to be explicit about the intent. |
| **Pin a specific model** | `model: haiku\|sonnet\|opus` | Always uses that model regardless of parent. |

```yaml
# Strategy 1: Omit — inherits parent model (most common)
# (no model field)

# Strategy 2: Explicit inherit — same result, clearer intent
model: inherit

# Strategy 3: Pin a specific model
model: haiku    # Fast/cheap — simple tasks, quick exploration
model: sonnet   # Balanced cost/capability
model: opus     # Complex reasoning, high-stakes decisions
```

**When to pin a model:**
- `haiku` — Read-only exploration, simple pattern matching, high-volume low-stakes work. Saves cost and latency.
- `sonnet` — Straightforward implementation, standard review, test generation, docs.
- `opus` — Nuanced judgment, multi-step reasoning, security/architecture review, complex refactoring, irreversible decisions.

**When to inherit:** When the subagent should adapt to however the user is running the main session. This is the right default for most agents.

### `skills`

Skills to auto-load. **Critical:** Subagents do NOT inherit skills from parent.

```yaml
skills: tdd, debugging, type-safety
```

If your agent needs specific skills, you must explicitly list them here.

### `disallowedTools`

Tools to deny, removed from inherited or specified list.

```yaml
disallowedTools: Write, Edit    # Deny write access even if tools inherits all
```

### `permissionMode`

Control permission handling for automation scenarios. Subagents inherit permission context from parent but can override the mode.

```yaml
permissionMode: default           # Standard permission checking with prompts
permissionMode: acceptEdits       # Auto-accept file edits
permissionMode: dontAsk           # Auto-deny permission prompts (explicitly allowed tools still work)
permissionMode: delegate          # Coordination-only mode for agent team leads
permissionMode: bypassPermissions # Skip all permission checks (use with caution)
permissionMode: plan              # Plan mode (read-only exploration)
```

If parent uses `bypassPermissions`, this takes precedence and cannot be overridden.

### `maxTurns`

Maximum number of agentic turns before the subagent stops.

```yaml
maxTurns: 50
```

### `mcpServers`

MCP servers available to this subagent. Each entry is a server name referencing an already-configured server or an inline definition.

```yaml
mcpServers:
  - slack                          # Reference existing server by name
  - my-server:                     # Inline definition
      command: npx
      args: ["-y", "@my/server"]
```

### `hooks`

Lifecycle hooks scoped to this subagent. Only active while the subagent runs. All hook events supported. `Stop` hooks are auto-converted to `SubagentStop`.

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
```

### `memory`

Persistent memory scope. Gives the subagent a directory that survives across conversations for building knowledge over time.

```yaml
memory: user      # ~/.claude/agent-memory/<name>/       — all projects
memory: project   # .claude/agent-memory/<name>/         — project-specific, shareable via git
memory: local     # .claude/agent-memory-local/<name>/   — project-specific, not committed
```

When enabled, the first 200 lines of `MEMORY.md` in the memory directory are included in the subagent's system prompt. Read, Write, and Edit tools are automatically enabled.

### `tools`

Restrict tool access. Default: inherits full access from parent.

```yaml
# Read-only analysis
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet

# With git history
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Bash(git show:*), Bash(git diff:*)

# Research agent
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, WebSearch, WebFetch
```

See [tools.md](tools.md) for detailed patterns.

### `color`

Status line color for this agent.

```yaml
color: orange
```

## File Naming

- Kebab-case: `security-reviewer.md`, `api-tester.md`
- No spaces or special characters
- Extension must be `.md`
- Filename = agent identifier

```
agents/security-reviewer.md     → subagent_type: "security-reviewer"
agents/db-migrator.md           → subagent_type: "db-migrator"
```

## File Locations

| Scope | Path | Priority |
|-------|------|----------|
| CLI flag | `--agents '{...}'` (JSON) | 1 (highest) |
| Project | `.claude/agents/` | 2 |
| Personal | `~/.claude/agents/` | 3 |
| Plugin | `<plugin>/agents/` | 4 (lowest) |

When multiple subagents share the same name, the higher-priority location wins. CLI-defined agents exist only for that session and aren't saved to disk.

## Minimal Example

```markdown
---
name: code-formatter
description: |
  Use this agent for code formatting tasks.

  <example>
  Context: User wants code formatted.
  user: "Format the utils module"
  assistant: "I'll use the code-formatter agent."
  </example>
model: inherit
---

# Code Formatter

Format code according to project style guide.
```

## Standard Example

```markdown
---
name: auth-security-reviewer
description: |
  Use this agent when reviewing authentication implementations.
  Triggers on auth flow review, token security, session management.

  <example>
  Context: User wants auth code reviewed.
  user: "Review the login flow for security issues"
  assistant: "I'll use the auth-security-reviewer agent."
  </example>

  <example>
  Context: User mentions specific auth concern.
  user: "Check our JWT token handling"
  assistant: "I'll delegate to the auth-security-reviewer agent."
  </example>
model: inherit
---

# Authentication Security Reviewer

## Expertise
- OAuth 2.0 and OIDC
- JWT tokens
- Session management

## Process
1. Analyze authentication flow
2. Check token handling
3. Verify session security
4. Report findings with severity
```

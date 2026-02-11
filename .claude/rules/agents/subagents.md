---
paths:
  - "**/agents/*.md"
---

# Agent Development

When creating or modifying agents, load the `claude-craft` skill.

## Frontmatter

Required fields: `name`, `description`, `tools`

```yaml
---
name: agent-name
description: "What it does and when to use it. Include trigger keywords."
model: sonnet
color: blue
tools: Read, Grep, Glob, Bash, Skill, TaskCreate, TaskUpdate, TaskList, TaskGet
skills:
  - skill-name
---
```

### tools

Comma-separated inline list. Never use YAML list syntax or space-separated values.

```yaml
# Correct
tools: Read, Grep, Glob, Bash, Skill

# Wrong
tools: Read Grep Glob Bash Skill
tools:
  - Read
  - Grep
```

Bash restrictions use parentheses: `Bash(bun *)`, `Bash(rg *)`.

Always include `Skill` so the agent can load skills at runtime.

### description

Quoted string. Include what the agent does, when to use it, and trigger keywords. Follow with `\n\n<example>` blocks for invocation examples.

### skills

YAML list of skill names the agent should auto-load. These are plugin-local names (not fully qualified).

## Body

Use concise bullet-point instructions with standardized keys. Each line covers one concern. Pick relevant keys — not all are needed for every agent.

| Key | Purpose | When to use |
|-----|---------|-------------|
| IDENTITY | Role and scope | Always — grounds the agent |
| TASK | Primary objective | Always — what to accomplish |
| SKILLS | Which skills to load at runtime | When agent relies on specific skills |
| PROCESS | Workflow or methodology to follow | When a skill defines the workflow |
| PATTERNS | Reference sources for conventions | When reusing existing patterns |
| OUTPUT | Artifact to produce | When agent delivers a specific deliverable |
| QUALITY | Standards and checks before delivery | When output has quality gates |
| EDGES | Edge cases, graceful degradation | When failure modes matter |
| ESCALATE | When to hand off or flag issues | When agent has bounded scope |
| COLLABORATE | How to work with other agents | When part of a multi-agent workflow |
| CONSTRAINTS | What NOT to do, boundaries | When scope needs explicit limits |
| COMPLETION | When the job is done | When "done" isn't obvious |

Example using 6 keys:

```markdown
- **IDENTITY:** You are an adoption guide for `@outfitter/*` packages
- **TASK:** Help users initialize Outfitter patterns in their codebase.
- **PROCESS:** Follow the `outfitter-start` skill's staged workflow.
- **PATTERNS:** Reference `outfitter-atlas` for conversion patterns.
- **OUTPUT:** Produce a plan at `.agents/plans/outfitter-start/`.
- **COMPLETION:** All handlers return Result types and compliance is verified.
```

Keep agent bodies short. Methodology belongs in skills, not agents.

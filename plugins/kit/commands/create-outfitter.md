---
description: Scaffold a new Outfitter Stack project or adopt patterns in existing code
argument-hint: [project name or path]
allowed-tools: Read Glob Bash Skill AskUserQuestion TaskCreate TaskUpdate TaskList TaskGet
---

# Create Outfitter Project

Load the `kit:outfitter-init` skill and begin initialization.

## Detection

First, check what we're working with:

```bash
ls package.json 2>/dev/null
```

## New Project (no package.json)

Follow the skill's **New Project Scaffolding** section:
1. Check for context files (CLAUDE.md, SPEC.md, PLAN.md)
2. Use AskUserQuestion to clarify template and name
3. Run `outfitter init <template> . --name <name>`

If $ARGUMENTS is provided, use it as the project name.

## Existing Project (has package.json)

This is an adoption/migration scenario. Point the user to the relevant resources:

**For migration**, focus on:
- [migration/assessment.md](skills/outfitter-init/migration/assessment.md) — Scope evaluation
- [migration/patterns-quick-ref.md](skills/outfitter-init/migration/patterns-quick-ref.md) — Conversion patterns

**For adding tooling only**, suggest:
```bash
outfitter add scaffolding
```

Then follow the skill's **Migration Workflow** section.

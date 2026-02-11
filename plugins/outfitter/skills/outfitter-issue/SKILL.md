---
name: outfitter-issue
version: 0.4.0
description: "Submit feedback to the Outfitter team via GitHub issues. Use after discovering bugs, missing features, unclear docs, or improvement opportunities in @outfitter/* packages."
allowed-tools: Bash(gh *), Bash(bun *), Bash(./scripts/*), Read
user-invocable: true
argument-hint: "<description of the issue>"
---

# Outfitter Issue

Submit issues to `outfitter-dev/outfitter` when you discover problems with @outfitter/* packages.

## Steps

1. **Parse input** — If `$ARGUMENTS` is provided, use it as the issue description to determine type, package, and title.
2. **Search first** — Check for duplicates before creating.
3. **Classify** — Determine issue type (bug, enhancement, docs, dx, unclear-pattern) from context.
4. **Draft** — Dry-run the create script, present the issue for user review.
5. **Submit** — After user approval, run with `--submit`.

## Before Creating an Issue

**Always search first** to avoid duplicates:

```bash
./scripts/search-issues.sh "keywords describing the issue"
```

If a similar issue exists, comment on it instead of creating a new one.

## Creating an Issue

Use the helper script with `--submit` to create an issue:

```bash
bun ./scripts/create-issue.ts \
  --type bug \
  --title "Brief description" \
  --package "@outfitter/contracts" \
  --description "What went wrong" \
  --actual "What actually happened" \
  --submit
```

### Dry-Run (Default)

Without `--submit`, the script outputs the `gh` command for review:

```bash
bun ./scripts/create-issue.ts --type bug --title "..." --package "..."
```

### Issue Types

| Type | When to Use | Required Fields |
|------|-------------|-----------------|
| `bug` | Something broke | package, description, actual |
| `enhancement` | Feature request | package, description, useCase |
| `docs` | Documentation gap | package, description, gap |
| `dx` | Poor developer experience | package, description, current |
| `unclear-pattern` | Confusing guidance | package, description, context |

For migration-specific feedback, see [references/migration-feedback.md](references/migration-feedback.md).

### View Template Requirements

```bash
bun ./scripts/create-issue.ts --type bug
```

## Labels

All issues created via this skill get:
- Category label (`bug`, `feature`, `documentation`, etc.)
- `feedback` — marks it as community feedback
- `source/agent` — indicates it came from an agent session

## Best Practices

- **Be specific** — include package name, function, and error if known
- **Provide context** — what task led to discovering this?
- **Include workaround** — if you found one, share it
- **Stay constructive** — focus on improvement, not complaint

---
name: migration-feedback
version: 0.1.0
description: Creates GitHub issues for problems discovered during migration to Outfitter Stack. Use when migration reveals bugs, missing features, unclear documentation, or improvement opportunities in @outfitter/* packages.
allowed-tools: Bash(gh *) Read
user-invocable: false
---

# Migration Feedback

Create GitHub issues on `outfitter-dev/stack` for problems discovered during migration.

## When to Use

Invoke this skill when migration work reveals:
- **Bugs** in @outfitter/* packages
- **Missing features** that would help migration
- **Unclear documentation** that caused confusion
- **Pattern gaps** where the stack doesn't have guidance
- **Ergonomic issues** that made migration harder than expected

## Issue Categories

| Category | Label | Example |
|----------|-------|---------|
| `bug` | `bug` | Package throws when it should return Result |
| `enhancement` | `enhancement` | Add helper for common migration pattern |
| `docs` | `documentation` | Handler contract docs missing edge case |
| `unclear-pattern` | `question` | How to handle X scenario with Result types |
| `dx` | `dx` | Error message unclear, hard to debug |

## Creating an Issue

### 1. Gather Context

Before creating, collect:
- Package name (`@outfitter/contracts`, etc.)
- Specific function or pattern
- What was expected vs actual behavior
- Minimal reproduction if applicable
- Migration context (what were you trying to do)

### 2. Create Issue

```bash
gh issue create \
  --repo outfitter-dev/stack \
  --title "[migration] Brief description" \
  --label "{{CATEGORY}}" \
  --label "migration-feedback" \
  --body "$(cat <<'EOF'
## Context

Discovered during migration of **{{PROJECT_NAME}}** to Outfitter Stack.

## Package

`{{PACKAGE_NAME}}`

## Description

{{DESCRIPTION}}

## Expected Behavior

{{EXPECTED}}

## Actual Behavior

{{ACTUAL}}

## Reproduction

{{REPRODUCTION}}

## Workaround

{{WORKAROUND}}

---

*Created via `os:migration-feedback` skill*
EOF
)"
```

### 3. Link to Migration Plan

After creating, add to `.outfitter/migration/plan/99-unknowns.md`:

```markdown
## Stack Feedback

- [ ] #{{ISSUE_NUMBER}}: {{TITLE}} — {{CATEGORY}}
```

## Issue Templates

### Bug Report

```bash
gh issue create \
  --repo outfitter-dev/stack \
  --title "[bug] Package X does Y instead of Z" \
  --label "bug" \
  --label "migration-feedback" \
  --body "..."
```

### Enhancement Request

```bash
gh issue create \
  --repo outfitter-dev/stack \
  --title "[enhancement] Add helper for X pattern" \
  --label "enhancement" \
  --label "migration-feedback" \
  --body "..."
```

### Documentation Gap

```bash
gh issue create \
  --repo outfitter-dev/stack \
  --title "[docs] Clarify X in Handler contract docs" \
  --label "documentation" \
  --label "migration-feedback" \
  --body "..."
```

### Unclear Pattern

```bash
gh issue create \
  --repo outfitter-dev/stack \
  --title "[question] How to handle X with Result types" \
  --label "question" \
  --label "migration-feedback" \
  --body "..."
```

## Check Existing Issues

Before creating a new issue, check if it already exists:

```bash
gh issue list --repo outfitter-dev/stack --label migration-feedback
gh issue list --repo outfitter-dev/stack --search "{{KEYWORDS}}"
```

## Batch Feedback

If multiple issues accumulated in `99-unknowns.md`, create them in batch:

1. Review all stack feedback items
2. Deduplicate similar issues
3. Create issues with cross-references where related
4. Update unknowns file with issue numbers

## Best Practices

1. **Be specific** — Include package, function, and line if known
2. **Provide context** — Explain what migration step led to discovery
3. **Include workaround** — If you found one, share it
4. **Link related issues** — Reference if similar issues exist
5. **Stay constructive** — Focus on improvement, not complaint

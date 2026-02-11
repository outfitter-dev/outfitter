---
name: check-skill-formatting
description: "Checks skill files for formatting violations — preprocessing patterns, placeholder conventions, and frontmatter. Use when validating skills, checking formatting, or when check formatting, lint skills, or skill quality are mentioned."
user-invocable: true
allowed-tools: Skill, Bash, Read, Glob, Grep
argument-hint: "[path]"
---

# Check Skill Formatting

Validate skill files against formatting conventions. Catches preprocessing hazards, placeholder violations, and frontmatter issues.

## Steps

1. Load the `/skillcheck` skill (runs preprocessing linter)
2. Run the placeholder linter to find `[string]` patterns that should use `{ string }` convention
3. Review findings and fix violations

## Placeholder Linter

Scan markdown files for `[string]` patterns that aren't markdown links or file references:

```bash
bun .claude/skills/check-skill-formatting/scripts/lint-placeholders.ts ${ARGUMENTS:-plugins/}
```

### What it catches

Instructional placeholders using brackets instead of braces:

| Found | Expected |
|-------|----------|
| `[Complete AWS-specific content]` | `{ complete AWS-specific content }` |
| `[Details follow...]` | `{ details follow }` |
| `[Section content]` | `{ section content }` |

### What it skips

- Markdown links: `[text](url)` or `[text](#anchor)`
- File references: `[file.md]`, `[config.json]`
- Checkboxes: `[x]`, `[ ]`, `[-]`
- GitHub admonitions: `[!NOTE]`, `[!WARNING]`
- Code fences and HTML comments
- All-caps tokens under 12 chars: `[REDACTED]`, `[TIME]`

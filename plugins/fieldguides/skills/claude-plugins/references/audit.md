# Plugin Audit Reference

Detailed validation checklists and output format for plugin audits.

## Severity Levels

| Level | Indicator | Meaning |
|-------|-----------|---------|
| Critical | `◈` | Blocks functionality, must fix |
| Warning | `◆` | Best practice violation, should fix |
| Info | `◇` | Suggestion, optional improvement |

## Output Format

```markdown
# Plugin Audit: {PLUGIN_NAME}

**Path**: {PATH}
**Status**: {PASS|WARNINGS|FAIL}
**Issues**: {CRITICAL} critical, {WARNINGS} warnings, {INFO} info

## Critical Issues

- `◈` {component}: {issue}
  - **Fix**: {specific remediation}

## Warnings

- `◆` {component}: {issue}
  - **Fix**: {specific remediation}

## Suggestions

- `◇` {component}: {suggestion}

## Summary

{1-2 sentence overall assessment}
```

## Checks by Component

### plugin.json

- [ ] File exists at `.claude-plugin/plugin.json`
- [ ] Valid JSON syntax
- [ ] `name` present and valid (lowercase, hyphens, 2-64 chars)
- [ ] `version` present and semver format
- [ ] `description` present and meaningful
- [ ] No unknown top-level fields

### Commands

- [ ] Frontmatter has `description`
- [ ] Description is action-oriented
- [ ] `argument-hint` uses `<required>` / `[optional]` syntax
- [ ] No broken file references (`@path`)
- [ ] Bash commands in backticks are valid

### Agents

- [ ] `name` matches filename (without `.md`)
- [ ] `description` has trigger conditions and examples
- [ ] `tools` field uses correct syntax (comma-separated)
- [ ] `model` is valid if specified

### Skills

- [ ] SKILL.md exists in skill directory
- [ ] Frontmatter has `name` and `description`
- [ ] Name matches directory name
- [ ] Description includes trigger keywords
- [ ] Under 500 lines (progressive disclosure)
- [ ] Referenced files exist

### Hooks

- [ ] Valid hook types (PreToolUse, PostToolUse, etc.)
- [ ] Matchers use valid glob/tool patterns
- [ ] Scripts have execute permissions
- [ ] Timeouts are reasonable (< 30s default)

## Auto-Fixable Issues

| Issue | Auto-Fix |
|-------|----------|
| Missing `description` in command | Generate from filename |
| Script missing execute permission | `chmod +x` |
| Trailing whitespace in YAML | Trim |
| Missing `version` in plugin.json | Add `"1.0.0"` |

Flag auto-fixable issues in output:

```markdown
- `◆` commands/deploy.md: Missing description [auto-fixable]
  - **Fix**: Add `description: "Deploy to environment"`
```

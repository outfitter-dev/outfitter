---
name: skillcheck
description: "Validates skill quality — preprocessing safety, frontmatter, line counts, references. Use when checking skills, validating SKILL.md, or when skillcheck, lint skill, or validate skill are mentioned."
context: fork
metadata:
  version: "1.0.1"
  author: outfitter
  preprocess: true
  related-skills:
    - skillcraft
    - claude-craft
allowed-tools: Read, Glob, Grep, Bash, Task
argument-hint: "[path]"
---

# Skills Check

Validate skill quality across one or more skill directories.

## Preprocessing Lint

Scan SKILL.md files for `` <bang>`command` `` patterns that trigger Claude Code's preprocessor unintentionally:

!`bun ${CLAUDE_PLUGIN_ROOT}/skills/skillcheck/scripts/lint-preprocessing.ts ${ARGUMENTS:-${CLAUDE_PLUGIN_ROOT}}`

## Interpreting Results

The linter reports:
- File path and line number of each finding
- The matched pattern and surrounding context
- Summary counts (clean, skipped, issues)

### Fixing Issues

| Finding | Fix |
|---------|-----|
| Unintentional `` <bang>`command` `` in SKILL.md | Replace ``!`` with `` <bang> `` |
| Intentional preprocessing | Add `metadata.preprocess: true` to frontmatter |

### The `<bang>` Convention

SKILL.md files are preprocessed by Claude Code — any `` <bang>`command` `` syntax executes when the skill loads. To safely document or reference the syntax:

- In SKILL.md: use `` <bang> `` as a stand-in for ``!``
- In reference files (references/, EXAMPLES.md): literal ``!`` is fine and encouraged
- In command files (commands/*.md): literal ``!`` is required (that's the feature)

Skills that intentionally preprocess (running scripts at load time) should declare it:

```yaml
metadata:
  preprocess: true
```

## Additional Checks

Beyond preprocessing, verify skill quality with existing tools:

```bash
# Frontmatter validation
bun ${CLAUDE_PLUGIN_ROOT}/scripts/validate-skill-frontmatter.ts <path-to-SKILL.md>

# Full plugin validation
bun ${CLAUDE_PLUGIN_ROOT}/scripts/validate-plugin.ts <plugin-directory>
```

## Deep Validation

After reviewing linter results, spawn the `quartermaster` agent to run deeper validation — frontmatter schema, naming conventions, description quality, line counts, and reference integrity. Pass it the same path argument.

## Quality Checklist

- [ ] No unintentional `` <bang>`command` `` in SKILL.md (this linter)
- [ ] Valid frontmatter (name, description, required fields)
- [ ] SKILL.md under 500 lines
- [ ] All referenced files exist
- [ ] Description has WHAT + WHEN + trigger keywords

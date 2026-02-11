# Preprocessing Safety

Claude Code preprocesses `!`command`` syntax — executing shell commands and injecting output before content reaches Claude. This is the primary mechanism for commands to include live context (git state, PR details, environment info).

## Where Preprocessing Runs

| Context | Preprocessed | Notes |
|---------|-------------|-------|
| Command files (`commands/*.md`) | Yes | Intentional — the core feature |
| SKILL.md files | Yes | Dangerous — examples will execute |
| Reference files, EXAMPLES.md | No | Safe for literal examples |
| Rules, CLAUDE.md, agents | No | Not preprocessed |

Preprocessing runs on the raw text before markdown parsing. Code fences (```), double backtick quoting, and other markdown constructs do not prevent execution. There is no escape mechanism — `\!` does not work.

## The `<bang>` Convention

In SKILL.md files, use `<bang>` as a stand-in for `!` when documenting or referencing the preprocessing syntax. Agents interpret `<bang>` as `!`.

Add an HTML comment near `<bang>` usage explaining the convention:

```html
<!-- <bang> represents ! — literal !`command` in SKILL.md triggers preprocessing -->
```

### Where to use what

| File type | Write | Why |
|-----------|-------|-----|
| SKILL.md | `` <bang>`command` `` | Prevents accidental execution |
| References, EXAMPLES.md | `!`command`` | Literal — safe and good for copy-paste |
| Command files | `!`command`` | Intentional execution |

## Examples

### Command file (correct — literal `!`)

`.claude/commands/git-context.md`:

```markdown
---
description: Show git context for current branch
allowed-tools: Bash(git *)
---

## Current State
Branch: !`git branch --show-current`
Status: !`git status --short`
Recent: !`git log --oneline -5`

Summarize the current state and suggest next steps.
```

The `!` backtick commands execute when the user runs `/git-context`, injecting live git output.

### SKILL.md (correct — uses `<bang>`)

```markdown
---
name: my-skill
description: "Demonstrates safe preprocessing documentation."
---

# My Skill

## Commands with Live Context

Commands can inject shell output using the preprocessing syntax:

<!-- <bang> represents ! — literal !`command` in SKILL.md triggers preprocessing -->

- `` <bang>`git status` `` — injects current git status
- `` <bang>`gh pr view --json title` `` — injects PR details

See [bash-execution.md](references/bash-execution.md) for examples.
```

Note: the reference file linked above CAN use literal `!` since reference files are not preprocessed.

### SKILL.md with intentional preprocessing

Some skills genuinely need to run commands at load time:

```yaml
---
name: environment-check
description: "Checks development environment."
metadata:
  preprocess: true
---
```

With `metadata.preprocess: true`, the `/skillcheck` linter will skip this file.

### Reference file (correct — literal `!` for copy-paste)

`references/bash-execution.md`:

```markdown
# Bash Execution

Execute shell commands and include output in your command's context.

## Syntax

!`command here`

## Examples

Branch: !`git branch --show-current`
Status: !`git status --short`
PR diff: !`gh pr diff`
```

This file is safe — reference files are not preprocessed. Users can copy these examples directly into command files.

## Common Mistakes

### Putting literal `!` in SKILL.md inside code fences

```markdown
# WRONG — this will execute even inside a code fence

## Example Command

` ` `markdown
Branch: !`git branch --show-current`
` ` `
```

Code fences do NOT prevent preprocessing in SKILL.md files.

### Trying to escape with backslash

```markdown
# WRONG — backslash escaping does not work
Branch: \!`git branch --show-current`
```

There is no escape mechanism. Use `<bang>` instead.

### Using double backtick quoting

```markdown
# WRONG — double backticks don't prevent preprocessing
| Feature | Syntax |
|---------|--------|
| Bash execution | `` !`command` `` |
```

The preprocessor matches `!` followed by backtick regardless of surrounding markdown.

## Linting

Run `/skillcheck` or the script directly:

```bash
# Scan all plugins
bun plugins/fieldguides/skills/skillcheck/scripts/lint-preprocessing.ts plugins/

# Scan a single skill
bun plugins/fieldguides/skills/skillcheck/scripts/lint-preprocessing.ts path/to/SKILL.md

# JSON output for tooling
bun plugins/fieldguides/skills/skillcheck/scripts/lint-preprocessing.ts plugins/ --json
```

The linter:
- Scans all `SKILL.md` files recursively
- Skips files with `metadata.preprocess: true`
- Reports file, line, column, and matched pattern
- Exits 0 (clean) or 1 (findings)

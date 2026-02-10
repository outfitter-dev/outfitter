---
paths:
  - "**/SKILL.md"
  - "**/skills/**/*.md"
---

# Formatting Conventions

## Markdown in Instructions

Avoid `**bold**` and other emphasis markers in skill/instruction text unless explicitly formatting output. Claude doesn't need visual emphasis to understand importance — the words themselves convey it.

**Use markdown when**: formatting actual output, examples, or user-facing content
**Skip markdown when**: writing instructions, rules, or guidance for Claude

## Concision Principle

Sacrifice grammar for concision — drop articles, filler words, verbose phrases. But don't strip meaning or context. Goal is density, not minimalism. If removing a word makes the instruction ambiguous, keep it.

Good: "Ask one question, wait for response"
Bad: "Ask question wait response"

## Variables and Placeholders

**Variables** — all caps, no spaces, curly braces:
- `{VARIABLE}` — concrete placeholder to be replaced
- Examples: `{N}`, `{REASON}`, `{BAR}`, `{NAME}`, `{FILE_PATH}`

**Instructional prose** — lowercase, spaces inside braces:
- `{ description of what goes here }` — guidance for what to fill in
- Examples: `{ question text }`, `{ why it matters }`, `{ if needed }`

## Markdown Tables

Use markdown tables for structured data. Ensure the table is properly formatted with the correct number of columns and rows.

```markdown
| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Data 1   | Data 2   | Data 3   |
```

Ensure pipes are properly aligned with spaces surrounding text or hyphens, at least between the header and separator rows. If pipes are used within a cell, ensure they are properly escaped.

## Indicators

Prefer ASCII/Unicode over emoji for indicators. Emoji acceptable sparingly — but default to Unicode symbols for consistency across terminals.

### Progress

- `░` — empty (light shade)
- `▓` — filled (medium shade)
- Example: `▓▓▓░░` = 3/5
- Use for confidence, completion, capacity — anything with discrete levels

### Severity

Escalating:

- `◇` — minor/informational
- `◆` — moderate/warning
- `◈` — severe/blocking
- Use for pushback, risk, alerts, uncertainty levels

### Caveats

- `△` — incomplete/uncertain (warning triangle U+25B3)
- **Mid-stream**: `△` + description — flags issue for immediate attention
- **At delivery**: `△ Caveats` — summary section of gaps, unknowns, assumptions, concerns, deferred items

### Checkmarks

- `✓` — completed/decided (U+2713)
- Use for "Decisions Made:" lists, completed items, confirmed choices
- Example:

  ```text
  Decisions Made:
  ✓ /sanity-check offers two modes: quick (skill) vs deep (agent)
  ✓ Agent returns: complexity identified + alternatives + escalation level
  ✓ Uses ◇/◆/◈ indicators from sanity-check skill
  ```

### Emphasis

Append to text:

- `⭐` — recommended/preferred

## Tasks

Give tasks friendly, context-specific descriptions instead of generic stage names. The description should tell the user what's actually happening.

**Prefer**:

```text
- [x] Consider skills to load
- [ ] Prep auth system requirements
- [ ] Explore authentication approaches
- [ ] Clarify platform and fallback needs
- [ ] Deliver implementation plan
```

**Avoid**:

```text
- [ ] Gather Context
- [ ] Synthesize Requirements
- [ ] Provide Deliverables
```

## Markdown Links

Use short aliases for readability. Keep paths intact.

Prefer: `[filename.md](path/to/filename.md)`
Avoid: `[path/to/filename.md](path/to/filename.md)`

```text
# Good
- [confidence.md](references/confidence.md)
- [FORMATTING.md](../rules/FORMATTING.md)

# Avoid
- [references/confidence.md](references/confidence.md)
- [../rules/FORMATTING.md](../rules/FORMATTING.md)
```

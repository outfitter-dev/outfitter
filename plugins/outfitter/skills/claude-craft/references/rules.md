# Rules Authoring

Create reusable instruction files in `.claude/rules/` for project conventions.

## Rules vs CLAUDE.md

| Aspect | CLAUDE.md | .claude/rules/ |
|--------|-----------|----------------|
| Loading | Automatic at session start | On-demand via reference |
| Content | Project setup, key commands | Reusable conventions |
| Size | Concise (~200-500 lines) | Can be detailed |
| Scope | This specific project | Patterns across files |

**Put in CLAUDE.md**: One-off instructions, project-specific commands, key file locations.

**Put in rules/**: Formatting conventions, architecture patterns, workflow guidelines, commit standards.

## File Conventions

### Naming

- **UPPERCASE.md** — All caps with `.md` extension
- **Topic-focused** — One concern per file
- **Kebab-case for multi-word** — `API-PATTERNS.md`, `CODE-REVIEW.md`

**Good**: `FORMATTING.md`, `TESTING.md`, `COMMITS.md`
**Bad**: `formatting.md`, `MyRules.md`, `everything.md`

### Structure

```
.claude/rules/
├── FORMATTING.md      # Code style, output conventions
├── TESTING.md         # Test patterns, coverage requirements
├── COMMITS.md         # Commit message format, PR conventions
├── ARCHITECTURE.md    # Component structure, file organization
└── SECURITY.md        # Security guidelines, auth patterns
```

Subdirectories are supported:

```
.claude/rules/
├── frontend/
│   ├── react.md
│   └── styles.md
├── backend/
│   ├── api.md
│   └── database.md
└── general.md
```

### Path-Specific Rules

Use YAML frontmatter with glob patterns to scope rules to specific files:

```yaml
---
paths:
  - "src/api/**/*.ts"
  - "lib/**/*.ts"
---

# API Development Rules
```

**Supported glob patterns**:
- `**/*.ts` — All TypeScript files
- `src/**/*` — All files under src/
- `*.md` — Markdown in root
- `src/components/*.tsx` — Specific directory
- `src/**/*.{ts,tsx}` — Brace expansion
- `{src,lib}/**/*.ts` — Multiple directories

## Content Structure

Rules files should be scannable and actionable:

```markdown
# Topic Name

Brief description of what this covers.

## Section 1

| Pattern | Example | Notes |
|---------|---------|-------|
| ... | ... | ... |

## Section 2

**Do:**
- Specific guideline

**Don't:**
- Anti-pattern to avoid

## Examples

{ concrete examples }
```

## Referencing Rules

### From CLAUDE.md

Reference rules explicitly — they're not auto-loaded:

```markdown
# CLAUDE.md

## Code Style
Follow `.claude/rules/FORMATTING.md` for all code conventions.

## Testing
See `.claude/rules/TESTING.md` for TDD patterns.
```

### Cross-file References

Use `@` syntax to include content from other files:

```markdown
# .claude/rules/FORMATTING.md

@./project-specific/FORMATTING.md
```

### Symlinks

Symlinks are supported for sharing rules:

```bash
ln -s ~/shared-claude-rules .claude/rules/shared
ln -s ~/company-standards/security.md .claude/rules/security.md
```

## Plugin Shared Rules

Plugins can organize shared rules internally:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── my-skill/
│       └── SKILL.md      # Can reference ../../rules/FORMATTING.md
└── rules/
    ├── FORMATTING.md
    └── PATTERNS.md
```

**Important limitation**: Shared rules only work WITHIN a single plugin. Paths that traverse outside the plugin root won't work after installation due to plugin caching.

**For cross-plugin patterns**: Use skill invocation (`plugin:skill-name`) instead of file references.

## Anti-Patterns

**Don't:**
- Create rules for one-off instructions (use CLAUDE.md)
- Duplicate content between CLAUDE.md and rules/
- Create catch-all files like `EVERYTHING.md`
- Expect rules to auto-load (they must be referenced)

**Do:**
- Keep each rule file focused on one topic
- Use tables and lists for scannability
- Reference shared rules via `@` when available
- Document why, not just what

# Migration Guide

Migrate existing agent documentation setups to the recommended AGENTS.md + @-mention pattern.

## Before You Start

Check your current setup:

```bash
# What agent docs exist?
ls -la CLAUDE.md AGENTS.md .claude/CLAUDE.md 2>/dev/null

# Are there symlinks?
file CLAUDE.md AGENTS.md 2>/dev/null | grep -i symbolic
```

## Migration Paths

### From: Single CLAUDE.md (No AGENTS.md)

**Current state**: One CLAUDE.md with all agent instructions.

**Steps**:

1. **Rename CLAUDE.md to AGENTS.md**
   ```bash
   mv CLAUDE.md AGENTS.md
   ```

2. **Remove tool-specific content from AGENTS.md**

   Move Claude-specific sections (task management, tool preferences) to `.claude/CLAUDE.md`:
   ```bash
   mkdir -p .claude
   # Extract Claude-specific content to .claude/CLAUDE.md
   ```

3. **Create minimal CLAUDE.md**
   ```bash
   cat > CLAUDE.md << 'EOF'
   # CLAUDE.md

   This file provides AI agents with project-specific context and conventions.

   @.claude/CLAUDE.md
   @AGENTS.md
   EOF
   ```

4. **Verify**
   ```bash
   # AGENTS.md should have no Claude-specific content
   grep -i "task\|TaskCreate\|TaskUpdate" AGENTS.md  # Should return nothing
   ```

### From: Symlinked CLAUDE.md → AGENTS.md

**Current state**: CLAUDE.md is a symlink to AGENTS.md (or vice versa).

**Steps**:

1. **Remove the symlink**
   ```bash
   # Check which is the symlink
   file CLAUDE.md AGENTS.md

   # Remove the symlink (keep the real file)
   rm CLAUDE.md  # if CLAUDE.md is the symlink
   ```

2. **Extract tool-specific content**

   Review AGENTS.md for Claude-specific content and move to `.claude/CLAUDE.md`.

3. **Create minimal CLAUDE.md**
   ```bash
   cat > CLAUDE.md << 'EOF'
   # CLAUDE.md

   This file provides AI agents with project-specific context and conventions.

   @.claude/CLAUDE.md
   @AGENTS.md
   EOF
   ```

### From: CLAUDE.md + AGENTS.md (No @-mentions)

**Current state**: Both files exist but aren't connected.

**Steps**:

1. **Audit for duplication**

   Check if content is duplicated between files:
   ```bash
   # Quick diff to spot similarities
   diff CLAUDE.md AGENTS.md
   ```

2. **Consolidate tool-agnostic content into AGENTS.md**

   Project structure, commands, architecture, code style, testing, git workflow → AGENTS.md

3. **Move Claude-specific content to .claude/CLAUDE.md**
   ```bash
   mkdir -p .claude
   # Move task management, tool preferences, etc.
   ```

4. **Replace root CLAUDE.md with @-mentions**
   ```bash
   cat > CLAUDE.md << 'EOF'
   # CLAUDE.md

   This file provides AI agents with project-specific context and conventions.

   @.claude/CLAUDE.md
   @AGENTS.md
   EOF
   ```

### From: .claude/CLAUDE.md Only (No Root Files)

**Current state**: Instructions only in `.claude/CLAUDE.md`.

**Steps**:

1. **Create AGENTS.md from tool-agnostic content**

   Extract project overview, commands, architecture, etc. to AGENTS.md.

2. **Keep Claude-specific content in .claude/CLAUDE.md**

3. **Create minimal root CLAUDE.md**
   ```bash
   cat > CLAUDE.md << 'EOF'
   # CLAUDE.md

   This file provides AI agents with project-specific context and conventions.

   @.claude/CLAUDE.md
   @AGENTS.md
   EOF
   ```

## Content Classification

Use this table to decide where content belongs:

| Content Type | Location |
|--------------|----------|
| Project overview | AGENTS.md |
| Directory structure | AGENTS.md |
| Available commands | AGENTS.md |
| Architecture patterns | AGENTS.md |
| Development principles (TDD, etc.) | AGENTS.md |
| Code style conventions | AGENTS.md |
| Testing approach | AGENTS.md |
| Git workflow | AGENTS.md |
| Task management (TaskCreate, etc.) | .claude/CLAUDE.md |
| Claude tool preferences | .claude/CLAUDE.md |
| MCP server usage | .claude/CLAUDE.md |
| Subagent coordination | .claude/CLAUDE.md |
| Language-specific rules (scoped) | .claude/rules/*.md |

## Post-Migration Verification

After migration, confirm:

- **No symlinks** — `file CLAUDE.md AGENTS.md` shows regular files
- **Root CLAUDE.md is minimal** — Just @-mentions, no content
- **AGENTS.md is tool-agnostic** — No Claude-specific instructions
- **.claude/CLAUDE.md exists** — Contains Claude-specific content
- **No duplication** — Each piece of content lives in one place
- **Both tools work** — Test with Claude Code and Codex (if applicable)

## Common Issues

### @-mention not working

Ensure the path is correct and the file exists:
```bash
# Check file exists at the path specified in @-mention
cat .claude/CLAUDE.md
cat AGENTS.md
```

### Content showing up twice

Check for duplication:
```bash
# Look for similar content across files
grep -r "## Commands" CLAUDE.md AGENTS.md .claude/CLAUDE.md
```

Remove duplicates — content should live in exactly one place.

### Codex not seeing conventions

Critical conventions must be in AGENTS.md. Codex doesn't read:
- `.claude/CLAUDE.md`
- `.claude/rules/*.md`

Move important rules to AGENTS.md if they need to work across tools.

---
name: linear-project-management
description: "Guides Linear project management — creates projects over tracking issues, structures PRDs, phases milestones, sizes issues, applies labels, and formats cross-references. Use when creating Linear projects, planning work, or organizing issues."
allowed-tools: ToolSearch, Read
metadata:
  version: 1.0.0
  author: outfitter
  category: project-management
  tags: [linear, project-management, workflow]
---

# Linear Project Management

Conventions for managing work in Linear. Covers project structure, PRDs, milestones, issue sizing, labeling, and cross-referencing.

## When to use this skill

- Creating or structuring a Linear project
- Writing a PRD or project description
- Breaking work into issues and milestones
- Deciding how to size, label, or cross-reference issues
- Posting project updates or status reports

## Projects Over Tracking Issues

**Always use Linear projects. Never use tracking issues** (parent issues with checklists or sub-issues used to group work).

Why:
- Projects have dedicated views, milestones, status updates, health tracking, and progress metrics
- Tracking issues conflate "the work" with "managing the work" — they show up in backlogs, get stale, and lack structure
- Projects support PRD-style content, timeline views, and cross-team visibility

### Project titles

Use backtick formatting for package names and technical terms:

```text
Batteries-included CLI conventions for `@outfitter/cli`
```

Linear renders backticks as inline code in titles, improving readability for technical projects.

### When to create a project

- Any coordinated effort spanning 3+ issues
- Work with distinct phases or milestones
- Efforts that need a PRD, success criteria, or status updates

Single issues don't need a project. But when in doubt, create the project — it's cheap and adds structure.

## Project Content as PRD

The project description field serves as the PRD. Use this structure:

### Template

```markdown
## Problem

What's wrong or missing. Be specific about who is affected and why the current state is inadequate.

## Solution

How we'll address it. High-level approach, not implementation details. Focus on the user-visible outcome.

## Design Principle

The guiding constraint that shapes decisions throughout implementation. One sentence.

Example: "Convention over configuration — sensible defaults, explicit overrides."

## Scope

### In scope
- Concrete deliverables (bullet list)

### Out of scope
- Things we're explicitly not doing (prevents scope creep)

## Milestones

### Milestone 1: Foundation
Core infrastructure. Issues: ...

### Milestone 2: Feature surface
User-facing functionality. Issues: ...

### Milestone 3: Polish
Edge cases, docs, DX refinements. Issues: ...

## Success Criteria

- Measurable outcomes that define "done"
- Include both technical criteria (tests pass, types check) and user criteria (workflow is faster, errors are clearer)
```

### Writing guidelines

- **Problem section**: Lead with the pain. Avoid solution-shaped problem statements ("We need to add X" is a solution, not a problem).
- **Design Principle**: One sentence. This is the tiebreaker for ambiguous decisions throughout the project.
- **Scope**: Be explicit about out-of-scope items. This prevents scope creep more than any other section.
- **Success Criteria**: Make them testable. "Better DX" is not a criterion. "CLI responds in <200ms for all commands" is.

## Milestones

Milestones group related issues into phases. They represent logical groupings, not strict sequential gates.

### Conventions

- **Milestones are concurrent within themselves** — issues in the same milestone can be worked in parallel
- **Milestones are roughly sequential** — Milestone 2 generally starts after Milestone 1 is mostly complete, but overlap is fine
- **Each milestone gets a description** — One sentence explaining what's achieved when this milestone is done
- **3-5 milestones per project** is typical. Fewer is fine. More suggests the project should be split.

### Naming pattern

Use descriptive names that convey what the milestone achieves:

| Pattern | Example |
|---------|---------|
| Foundation | Core types and contracts |
| Feature surface | User-facing commands and options |
| Integration | Cross-package wiring |
| Polish | Edge cases, docs, DX |
| Hardening | Performance, error handling, tests |

Avoid generic names like "Phase 1" or "Sprint 3" — they carry no meaning.

### Assigning issues to milestones

Every issue in a project should belong to a milestone. Unassigned issues create ambiguity about when they'll be addressed. If an issue doesn't fit a milestone, either:

1. Create a milestone for it
2. Question whether it belongs in this project

## Issue Sizing

Issues map 1:1 to pull requests. This is the fundamental sizing constraint.

### Target size

| Metric | Target | Hard limit |
|--------|--------|------------|
| Effective LOC | 100-250 | ~300 (non-mechanical) |
| Files touched | 3-5 | 8 |
| Review time | 30-60 min | 60 min |

**Effective LOC** = lines that require human review. Excludes lockfiles, codegen, formatting-only changes.

### Sizing heuristics

- **Too small**: Issue describes a one-line fix that doesn't warrant a PR description. Combine with related work.
- **Right size**: Issue has a clear single outcome, tests fit naturally, PR can be reviewed in one sitting.
- **Too large**: Issue requires multiple logical commits or touches unrelated subsystems. Split it.

### Stacked issues mirror stacked PRs

When work naturally sequences (each piece builds on the last), create stacked issues that mirror the PR stack:

```text
Issue: Add base types for config        → PR 1 (foundation)
Issue: Implement config loader          → PR 2 (stacked on PR 1)
Issue: Add CLI flags for config options  → PR 3 (stacked on PR 2)
```

Use issue dependencies (`blocks`/`blocked by`) in Linear to express this ordering.

### Mechanical changes

Formatting, renames, codegen, lockfile updates — isolate these in their own issue/PR or mark clearly as mechanical. They inflate LOC counts and obscure meaningful changes when mixed with feature work.

## Labeling

**Every issue and project gets at least one label.** Labels enable filtering, reporting, and quick orientation.

### Common label dimensions

| Dimension | Examples | When to use |
|-----------|----------|-------------|
| Package | `@outfitter/cli`, `@outfitter/contracts` | Scopes issue to a specific package |
| Type | `feature`, `bug`, `chore`, `docs` | Classifies the nature of work |
| Concern | `DX`, `performance`, `security`, `testing` | Cross-cutting quality attribute |

### Guidelines

- **Use existing labels** before creating new ones. Check available labels first.
- **One package label per issue** when the change is scoped to a single package.
- **Multiple labels are fine** — an issue can be both `@outfitter/cli` and `DX`.
- **Project labels** should reflect the primary concern or domain, not individual issue types.

## Cross-Referencing

Consistent cross-referencing connects issues, PRs, and projects into a navigable web of context.

### Linear URLs — bare URLs only

When referencing Linear issues or projects from within Linear (descriptions, comments, updates), use bare URLs:

```text
https://linear.app/outfitter/issue/OS-176/outfittercli-first-class-queryability
https://linear.app/outfitter/project/batteries-included-cli-conventions-78e01e25016a
```

Linear auto-generates rich embeds with status badges, icons, and full titles. Using markdown link format (`[text](url)`) **downgrades** the rendering to plain text.

The URL slug after the issue ID is optional but improves readability.

### GitHub URLs — markdown links

When referencing GitHub PRs or issues from within Linear, use markdown link format:

```markdown
Implemented in [#405](https://github.com/outfitter-dev/stack/pull/405).
See [outfitter-dev/stack#42](https://github.com/outfitter-dev/stack/issues/42) for details.
```

GitHub URLs don't get rich embeds in Linear, so descriptive link text provides necessary context.

### Never use bare identifiers

`OS-176` and `#405` are not clickable in Linear. Always provide full URLs.

### Angle bracket gotcha

Linear's storage wraps URLs in angle brackets internally (`[text](<url>)`). This can break rendering in some contexts. This is another reason bare URLs are preferred for Linear-to-Linear references.

## Commenting conventions

### Issue comments

- Use comments for status updates, decisions, and context that emerged after issue creation
- Reference relevant PRs, related issues, or blocking items with proper cross-references
- Avoid noisy comments ("Working on this", "Started") — Linear has status fields for that

### Project updates

Post project updates for milestone completions, blockers, or significant progress. Include:

- **Health status**: `onTrack`, `atRisk`, or `offTrack`
- **What's changed** since the last update
- **What's next** — upcoming work or decisions needed
- **Blockers** if any

## API Quick Reference

### Tool selection

| Operation | Tool |
|-----------|------|
| Create/update issues | `mcp__claude_ai_Linear__create_issue`, `update_issue` |
| Create/update projects | `mcp__claude_ai_Linear__create_project`, `update_project` |
| Milestones | `mcp__claude_ai_Linear__create_milestone`, `update_milestone` |
| List/search | `mcp__claude_ai_Linear__list_issues`, `list_projects` |
| Labels | `mcp__claude_ai_Linear__list_issue_labels`, `create_issue_label` |
| Documents | `mcp__claude_ai_Linear__create_document`, `update_document` |
| Project status updates | `save_status_update` or GraphQL for more control |
| Comments with formatting | GraphQL `commentCreate` (the `comment` action breaks newlines) |

### Before calling any Linear tool

Linear MCP tools are deferred. Load them first:

```text
ToolSearch with query: "+linear <operation>"
```

For complete API recipes, GraphQL patterns, and gotchas, see `references/api-patterns.md`.

---
paths:
  - "**/SKILL.md"
  - "**/skills/**/*.md"
---

# Agent Skills Development

- When creating or modifying agent skills, load the `skillcraft` skill
- If working on Claude-specific skill features, load the `claude-craft` skill.

## XML Tags

Use XML tags for structural sections in skill files:
- `<when_to_use>` — trigger conditions
- `<confidence>` — confidence levels/tracking
- `<stages>` — workflow stages
- `<workflow>` — core process loop
- `<rules>` — always/never constraints
- `<references>` — links to supporting docs

Keep content inside tags terse. Sacrifice grammar for concision where meaning is preserved.

GitHub rendering: Add blank lines after opening tags and before closing tags. Without them, content renders incorrectly on GitHub.

```markdown
<!-- Good -->
<rules>

- First rule
- Second rule

</rules>

<!-- Bad — won't render properly on GitHub -->
<rules>
- First rule
- Second rule
</rules>
```

## Skill References

When referencing skills in documentation, use specific language based on skill type:

| Skill Type | Language | Example |
|------------|----------|---------|
| Standard | "Load the skill" | Load the `skillcraft` skill |
| Delegated (`context: fork` + `agent: general-purpose`) | "Delegate by loading" | Delegate by loading the `security-audit` skill |

Standard skills load instructions into the current context. The agent continues with those instructions available.

Delegated skills hand off work to a subagent. The subagent runs in isolation and returns results.

Format: Always use backticks for skill names: "`skill-name`"

Never link to SKILL.md files. Always use the load/delegate pattern.

```markdown
# Wrong
See [skillcraft](../skillcraft/SKILL.md) for patterns.

# Right
Load the `skillcraft` skill for patterns.
```

## Steps

Use a `## Steps` section for composable skill workflows. Place immediately after the H1 title.

```markdown
## Steps

1. Load the `prerequisite-skill` skill
2. { main action for this skill }
3. If { condition }, load the `conditional-skill` skill
...
9. { final action or output }
```

Pattern rules:

- Numbered list (order matters)
- Skill references use: "Load the `skill-name` skill"
- Conditional steps: `If { condition }, load...` or `If { condition }, { action }`
- Action descriptions: brief, imperative, no articles
- Keep to 3-6 steps; split into stages if longer

Delegated skills: See Skill References section above for load vs delegate language.

Plan mode and questions — use for decision points and user input:

```markdown
5. Enter `Plan` mode
6. Present options with `AskUserQuestion`
```

Brainstorming — for complex problems, get multiple perspectives:

```markdown
2. Brainstorm with `Plan` agent for approaches
```

When to use:

- Skill depends on another skill being loaded first
- Workflow has clear sequential stages
- Steps can branch based on context

When to skip:

- Single-purpose skills with no dependencies
- Skills where workflow is the entire body (use `<workflow>` tag instead)

## Interactive Questions

For multi-option questions in skills:

- Use `EnterPlanMode` — enables keyboard navigation
- Prose above tool: context, "why it matters"
- Inside tool: options with inline recommendation marker
- Always include escape hatch: "5. Something else — { brief prompt }"

### Inline Recommendations

Mark recommended option inline with `⭐` + emphasized rationale:

```text
1. Google only ⭐ — *simplest, highest coverage *good starting point, expand later*
2. Google + GitHub — *covers consumer and developer users*
3. Google + GitHub + Microsoft — *comprehensive, more maintenance*
```

Pattern: `N. Option name ⭐ — brief description *why recommended*`

- `⭐` visually distinguishes the recommendation
- `*italicized rationale*` provides quick reasoning
- Everything scannable in one place

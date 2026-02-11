---
name: skill-distillery
description: "Distills tool patterns from external repositories into teachable skills and plugins. Use when build plugin for, create skills for CLI, package as plugin, repo to plugin, or turn into plugin are mentioned."
metadata:
  version: "1.0.0"
  related-skills:
    - research
    - codebase-analysis
    - find-patterns
    - codify
    - skillcraft
    - claude-craft
    - claude-plugins
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, TaskCreate, TaskUpdate, TaskList, TaskGet, AskUserQuestion, Skill
---

# Skill Distillery

Transform external repositories into Claude Code plugins.

```text
External Repo → Research → Recon → Patterns → Codify → Author → Package → Audit → Plugin
```

## Steps

1. Clarify target repo and plugin goals
2. Load the `research` skill for external discovery (docs, APIs, community patterns)
3. Load the `codebase-analysis` skill for internal analysis of target repo
4. Load the `find-patterns` skill to extract repeatable patterns worth automating
5. Load the `codify` skill to map patterns to component types
6. Author components using `skillcraft` or `claude-craft`
7. Load the `claude-plugins` skill to package into distributable plugin
8. Validate using the `claude-plugins` audit checklists

<when_to_use>

- Turning a CLI tool into a Claude Code plugin
- Creating skills that wrap an external library or API
- Building plugin companions for MCP servers
- Extracting automation opportunities from a third-party repo
- Packaging workflow patterns around external tools

NOT for: plugins from scratch (use `claude-plugins`), single-skill creation (use `skillcraft`), auditing existing plugins (use `claude-plugins`)

</when_to_use>

## Artifact Structure

Track progress with artifacts in `artifacts/skill-distillery/`:

```text
artifacts/skill-distillery/
├── discovery.md      # Research output (docs, APIs, community patterns)
├── recon.md          # Codebase analysis (structure, conventions, key files)
├── patterns.md       # Extracted patterns with automation value
├── mapping.md        # Pattern → component mapping decisions
├── components/       # Authored skills, agents, hooks, commands
│   ├── skill-1/
│   ├── skill-2/
│   └── ...
└── audit.md          # Plugin validation results
```

## Quick Mode

For simple repos (single-purpose CLI, small API wrapper):

1. Skip stages 3-4 — go direct from recon to authoring
2. Create 1-2 skills covering primary use cases
3. Package immediately

Trigger: User says "quick", repo has < 5 main commands, or clear single purpose.

## Stages

Load the `maintain-tasks` skill for stage tracking. Stages advance only.

| Stage | Skill | activeForm |
|-------|-------|------------|
| 1. Discovery | `research` | "Researching external docs" |
| 2. Recon | `codebase-analysis` | "Analyzing target repo" |
| 3. Patterns | `find-patterns` | "Extracting patterns" |
| 4. Mapping | `codify` | "Mapping to components" |
| 5. Authoring | `skillcraft` | "Creating components" |
| 6. Packaging | `claude-plugins` | "Packaging plugin" |
| 7. Audit | `claude-plugins` | "Validating plugin" |

<workflow>

### Stage 1: Discovery

Load `research` skill. Gather external docs, community patterns, pain points.

See [stage-1-discovery.md](references/stage-1-discovery.md) for details.

### Stage 2: Recon

Load `codebase-analysis` skill. Analyze structure, API surface, conventions.

See [stage-2-recon.md](references/stage-2-recon.md) for details.

### Stage 3: Patterns

Load `find-patterns` skill. Extract workflows, command sequences, decision points.

See [stage-3-patterns.md](references/stage-3-patterns.md) for details.

### Stage 4: Mapping

Load `codify` skill. Map patterns to component types (skill, command, hook, agent).

See [stage-4-mapping.md](references/stage-4-mapping.md) for details.

### Stage 5: Authoring

Load appropriate skill per component type. Create in `artifacts/skill-distillery/components/`.

See [stage-5-authoring.md](references/stage-5-authoring.md) for details.

### Stage 6: Packaging

Load `claude-plugins` skill. Create plugin structure with manifest and README.

Ask: "Do you have an existing marketplace to add this plugin to?" If yes, prepare the marketplace entry.

See [stage-6-packaging.md](references/stage-6-packaging.md) for details.

### Stage 7: Audit

Validate using the `claude-plugins` audit checklists. See its `references/audit.md`.

See [stage-7-audit.md](references/stage-7-audit.md) for details.

</workflow>

<decision_points>

Key decisions during engineering process:

**Which patterns to automate?**
- High frequency + medium complexity = best ROI
- Low frequency + high complexity = consider if audience is technical
- One-off patterns = skip

**Skills vs Commands?**
- Multi-step, needs guidance → Skill
- Quick action, obvious usage → Command
- User entry point to skill → Both (command loads skill)

**Include agents?**
- Only for complex repos with orchestration needs
- Most plugins don't need custom agents
- Consider if existing agents (analyst, engineer) suffice

**Quick mode vs full pipeline?**
- Single-purpose tool → Quick mode
- Complex tool with many features → Full pipeline
- Unclear → Start with recon, decide after

</decision_points>

<rules>

ALWAYS:
- Start with discovery before touching code
- Track artifacts at each stage
- Validate patterns have 3+ use cases before creating components
- Use existing skills for authoring (don't reinvent)
- Run audit before declaring complete

NEVER:
- Skip recon stage (even for familiar repos)
- Create agents without clear orchestration need
- Package without audit validation
- Over-engineer (simpler plugin > feature-complete plugin)

</rules>

<references>

Stage guides:
- [overview.md](references/overview.md) — quick reference
- [stage-1-discovery.md](references/stage-1-discovery.md) — external research
- [stage-2-recon.md](references/stage-2-recon.md) — codebase analysis
- [stage-3-patterns.md](references/stage-3-patterns.md) — pattern extraction
- [stage-4-mapping.md](references/stage-4-mapping.md) — component selection
- [stage-5-authoring.md](references/stage-5-authoring.md) — creating components
- [stage-6-packaging.md](references/stage-6-packaging.md) — plugin structure
- [stage-7-audit.md](references/stage-7-audit.md) — validation
- [repo-types.md](references/repo-types.md) — CLI vs Library vs MCP patterns

Skills loaded:
- `research` — external discovery methodology
- `codebase-analysis` — repo analysis approach
- `find-patterns` — pattern extraction
- `codify` — pattern-to-component mapping
- `claude-plugins` — plugin packaging

</references>

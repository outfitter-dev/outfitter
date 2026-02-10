# Skill Distillery Overview

Quick reference for the repo-to-plugin transformation workflow.

## Stages

| Stage | Skill Loaded | Output |
|-------|--------------|--------|
| 1. Discovery | `outfitter:research` | `artifacts/skill-distillery/discovery.md` |
| 2. Recon | `outfitter:codebase-analysis` | `artifacts/skill-distillery/recon.md` |
| 3. Patterns | `outfitter:find-patterns` | `artifacts/skill-distillery/patterns.md` |
| 4. Mapping | `outfitter:codify` | `artifacts/skill-distillery/mapping.md` |
| 5. Authoring | `outfitter:skillcraft` | `artifacts/skill-distillery/components/` |
| 6. Packaging | `outfitter:claude-plugins` | Plugin directory |
| 7. Audit | `outfitter:claude-plugins` | `artifacts/skill-distillery/audit.md` |

## Quick Mode

Skip stages 3-4 for simple repos:

```
Discovery → Recon → Authoring → Packaging → Audit
```

Trigger: Single-purpose tool, < 5 commands, user requests speed.

## Stage References

- [stage-1-discovery.md](stage-1-discovery.md) — External research
- [stage-2-recon.md](stage-2-recon.md) — Codebase analysis
- [stage-3-patterns.md](stage-3-patterns.md) — Pattern extraction
- [stage-4-mapping.md](stage-4-mapping.md) — Component selection
- [stage-5-authoring.md](stage-5-authoring.md) — Creating components
- [stage-6-packaging.md](stage-6-packaging.md) — Plugin structure
- [stage-7-audit.md](stage-7-audit.md) — Validation
- [repo-types.md](repo-types.md) — CLI vs Library vs MCP patterns

## Common Pitfalls

**Over-engineering**: Creating agents when skills suffice, multiple commands for related actions.

**Under-engineering**: Single skill doing everything, missing error handling, no documentation.

**Scope creep**: Adding "nice to have" features before core works.

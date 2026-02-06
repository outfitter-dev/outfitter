# Outfitter Init Plan

**Project:** {{PROJECT_NAME}}
**Generated:** {{DATE}}
**Type:** {{PROJECT_TYPE}}

## Navigation

- [Scan Results](./SCAN.md) — Codebase analysis and scope
- **Stages:**
  - [Overview](./stages/overview.md) — Status dashboard and dependencies
  - [Foundation](./stages/foundation.md) — Dependencies, context, logger
  - [Handlers](./stages/handlers.md) — Handler conversions
  - [Errors](./stages/errors.md) — Error taxonomy mappings
  - [Paths](./stages/paths.md) — XDG path migrations
  - [Adapters](./stages/adapters.md) — CLI/MCP transport layers
  - [Documents](./stages/documents.md) — Documentation updates
  - [Unknowns](./stages/unknowns.md) — Items requiring review

## Quick Start

1. Review [SCAN.md](./SCAN.md) to understand scope
2. Adjust priorities in [stages/overview.md](./stages/overview.md)
3. Begin with [stages/foundation.md](./stages/foundation.md)
4. Load `kit:outfitter-fieldguide` for patterns and templates

## Recommended Order

```
Foundation (required first)
    │
    ├── Paths (parallel)
    │
    └── Handlers
            │
            ├── Errors
            │
            └── Adapters
                    │
                    └── Documents (last)

Unknowns: Review throughout
```

## Verification

When complete, run:

```bash
# Should return no results
rg "throw new" --type ts
rg "console\.(log|error|warn)" --type ts
rg "homedir\(\)" --type ts
```

Then use `kit:outfitter-check` for full compliance audit.

## Resources

- [outfitter-fieldguide](kit:outfitter-fieldguide) — Patterns and templates
- [outfitter-check](kit:outfitter-check) — Compliance verification
- [AGENTS.md](../../AGENTS.md) — Project development guide

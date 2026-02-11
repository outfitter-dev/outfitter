---
description: Adopt Outfitter Stack patterns in a codebase through a phased workflow
argument-hint: [project path]
allowed-tools: Read Write Edit Glob Grep Bash Skill Task
---

# Adopt Outfitter Stack

Target: $ARGUMENTS

## Steps

1. **Load Skills** — Use Skill tool to load `context-management` for task persistence.
2. **Init** — Delegate to **Plan subagent** with `outfitter-init` to:
   - Scan codebase for adoption candidates (throws, console, paths, custom errors)
   - Enumerate all published `@outfitter/*` packages (not just pattern-matched ones)
   - Estimate caller blast radius for high-impact function conversions
   - Keep `@outfitter/types` conditional unless clear adoption points exist
   - Assess scope and effort
   - Generate `.agents/plans/outfitter-init/` with scan results and staged plan
   - Return implementation strategy
3. **Execute** — Delegate phases to `stacker`:
   - `outfitter-fieldguide` — Scaffold context, logger, dependencies
   - `tdd` + `outfitter-fieldguide` — TDD handler conversions
   - `outfitter-fieldguide` — Wire CLI/MCP transport layers
   - `outfitter-check` — Verify compliance
4. **Persist** — Update Tasks throughout with progress and decisions.
5. **Feedback** — If issues discovered, delegate to `stacker` with `outfitter-feedback`.

Proceed without interrupting the user, unless necessary.

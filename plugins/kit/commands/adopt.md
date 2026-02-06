---
description: Adopt Outfitter Stack patterns in a codebase through a phased workflow
argument-hint: [project path]
allowed-tools: Read Write Edit Glob Grep Bash Skill Task
---

# Adopt Outfitter Stack

Target: $ARGUMENTS

## Steps

1. **Load Skills** — Use Skill tool to load `outfitter:context-management` for task persistence.
2. **Init** — Delegate to **Plan subagent** with `kit:outfitter-init` to:
   - Scan codebase for adoption candidates (throws, console, paths, custom errors)
   - Assess scope and effort
   - Generate `.agents/plans/outfitter-init/` with scan results and staged plan
   - Return implementation strategy
3. **Execute** — Delegate phases to `kit:stacker`:
   - `kit:outfitter-fieldguide` — Scaffold context, logger, dependencies
   - `outfitter:tdd` + `kit:outfitter-fieldguide` — TDD handler conversions
   - `kit:outfitter-fieldguide` — Wire CLI/MCP transport layers
   - `kit:outfitter-check` — Verify compliance
4. **Persist** — Update Tasks throughout with progress and decisions.
5. **Feedback** — If issues discovered, delegate to `kit:stacker` with `kit:outfitter-feedback`.

Proceed without interrupting the user, unless necessary.

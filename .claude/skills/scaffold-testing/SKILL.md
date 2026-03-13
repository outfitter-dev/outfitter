---
name: scaffold-testing
version: 0.1.0
description: "Smoke test a scaffold preset end-to-end. Runs init, install, build, test, explores output, and writes a structured report.json with quality scores. Use when scaffold testing, preset smoke test, or scaffold report are mentioned."
---

# Scaffold Testing

Smoke test a single scaffold preset end-to-end and produce a structured quality report.

## Workflow

### Phase 1: Read Context

Read the preset name and run directory from the prompt context. Confirm:
- Preset name (one of: basic, cli, library, full-stack, minimal, mcp, daemon)
- Run directory path (where to scaffold and write report.json)
- Report output path (typically `<run-dir>/<preset>/report.json`)

### Phase 2: Scaffold

Run the scaffold command from the repo root:

```bash
bun ./apps/outfitter/src/cli.ts init <dir> --name scaffold-e2e-<preset> --preset <preset> --yes --skip-git --skip-commit
```

Note: Do NOT pass `--skip-install` — we want to test the real install flow in Phase 3.

Record: exit code, stdout, stderr, duration.

### Phase 3: Install

Run `bun install` in the scaffolded directory.

Record: exit code, stdout, stderr, duration, any warnings about peer deps or resolution issues.

### Phase 4: Build

Check if `package.json` has a `build` script. If yes, run `bun run build`. If no (e.g., minimal preset), mark as `skipped` with reason `"no build script"`.

Record: exit code, stdout, stderr, duration.

### Phase 5: Verify

Run `bun run verify:ci` if the script exists in `package.json`. Fall back to `bun test` if `verify:ci` is absent. If neither exists, mark as `skipped`.

Record: exit code, stdout, stderr, duration.

### Phase 6: Explore and Score

Read key files and apply the scoring rubric:

1. **README.md** — Does it exist? Does it cover setup, usage, development?
2. **CLAUDE.md / AGENTS.md** — Agent-readiness documentation
3. **package.json** — Scripts, dependencies, metadata completeness
4. **src/** — Entry points, type safety, handler patterns
5. **tsconfig.json** — Strict mode, compiler options

Load the `outfitter-atlas` skill to cross-check against documented patterns. Note any inconsistencies between what the docs say and what the scaffold produces.

Apply scoring rubric from `references/scoring-rubric.md`:
- Agent Readiness (1-10)
- Documentation Completeness (1-10)
- Error Clarity (1-10)
- Setup Friction (1-10)
- Type Correctness (1-10)
- Overall (weighted average)

Every score MUST cite specific files, line numbers, or command output. No hand-waving.

### Phase 7: Report

Write `report.json` to the preset directory following the schema in `references/report-schema.md`.

Include:
- All phase results (ok/failed/skipped with duration, stdout, stderr)
- All scores with reasoning
- Findings (blocking, degraded, cosmetic) with file/line references
- Doc inconsistencies found via outfitter-atlas cross-check
- Suggestions for improvement

## Key Constraints

- **Never stop at first failure.** If a phase fails, mark subsequent dependent phases as `skipped` with reason, but still explore files and score what's observable.
- **Stay in your lane.** Do not modify files outside the assigned preset directory. Do not run git commands.
- **Be specific.** Cite file paths, line numbers, and exact error messages in scores and findings.
- **Capture everything.** Record stdout/stderr for every command, even successful ones.

## References

- `references/report-schema.md` — Full JSON schema for report.json
- `references/scoring-rubric.md` — Behavioral anchors for each dimension
- `references/preset-expectations.md` — Per-preset expected files and common issues

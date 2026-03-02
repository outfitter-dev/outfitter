---
name: docs-worker
description: Writes package documentation from code analysis — READMEs, pattern guides, API docs.
---

# Docs Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that involve writing or updating documentation:

- Package-level docs in `packages/<pkg>/docs/`
- README updates for packages
- Migration guides
- Pattern documentation (error handling, CLI patterns, etc.)

## Work Procedure

### 1. Understand the Feature

- Read the feature description — it references a Linear issue specifying what to document.
- Read `AGENTS.md` for mission boundaries, key source files, and conventions.
- Read `.factory/library/architecture.md` for cross-package patterns.

### 2. Analyze the Source Code

This is the most critical step. Documentation MUST match actual code, not assumptions.

- Read ALL source files relevant to the APIs being documented.
- Read existing tests to understand intended behavior and edge cases.
- Read existing README for the package to understand current doc style and structure.
- Grep for actual function signatures, exported types, and real usage patterns.
- Check `package.json` `exports` field to understand available subpath imports.

**Anti-pattern: Do NOT document APIs that don't exist (phantom APIs).** Verify every function name, every parameter, every type before writing about it. Use grep to confirm:

```bash
rg "export.*functionName" packages/<pkg>/src/
```

### 3. Write Documentation

- Use the existing doc style in the package (check README.md and any existing `docs/` files).
- Structure: problem statement -> solution -> code example -> details.
- Code examples MUST be runnable — use actual import paths, actual function signatures.
- For pattern docs: show the anti-pattern (what adopters do wrong) then the correct pattern.
- Keep it concise. Agents read docs too — optimize for scanability.
- File naming: lowercase-kebab-case (e.g., `error-handling-patterns.md`, `cli-patterns.md`).

### 4. Cross-Reference

After writing, verify every claim in the doc:

- Every function name exists in the source (`rg "export.*<name>" packages/<pkg>/src/`)
- Every import path exists in `package.json` exports
- Every code example uses correct types and signatures
- Any peer dep claims match actual `package.json`

### 5. Verify

```bash
# Lint (do NOT use 'bun run check' — format:check has a pre-existing crash)
bun run lint

# Type safety
bun run typecheck

# Ensure no test breakage
bun run test
```

### 6. Commit

Commit with conventional commit format:

```
docs(contracts): add error handling patterns guide [OS-338]
```

Documentation-only changes to `docs/` directories do not need changesets unless they modify the package README.

## Example Handoff

```json
{
  "salientSummary": "Wrote error handling patterns doc at packages/contracts/docs/error-handling-patterns.md covering: error boundary guidance (Results for domain, throws for protocol), MCP boundary rule (always return Result from tool handlers), taxonomy visibility (link to error category table), and adaptHandler() bridge pattern with code example. Cross-referenced all function names against source — all verified.",
  "whatWasImplemented": "New documentation file packages/contracts/docs/error-handling-patterns.md (~120 lines). Covers 4 topics from the issue spec: error boundaries, MCP boundary rule, taxonomy visibility, adaptHandler() use case. All code examples verified against actual source signatures.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "test -f packages/contracts/docs/error-handling-patterns.md",
        "exitCode": 0,
        "observation": "File exists"
      },
      {
        "command": "rg 'export.*adaptHandler' packages/mcp/src/",
        "exitCode": 0,
        "observation": "Confirmed adaptHandler export in types.ts"
      },
      {
        "command": "rg 'export.*OutfitterError' packages/contracts/src/",
        "exitCode": 0,
        "observation": "Confirmed OutfitterError export"
      },
      { "command": "bun run check", "exitCode": 0, "observation": "Clean" },
      {
        "command": "bun run test",
        "exitCode": 0,
        "observation": "3280 tests passed"
      },
      {
        "command": "bun run typecheck",
        "exitCode": 0,
        "observation": "No errors"
      }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": []
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- The APIs referenced in the issue spec don't exist in the codebase (phantom APIs)
- The existing code contradicts what the issue says should be documented
- The package has no README or docs pattern to follow (need guidance on doc location/format)
- The feature requires documenting behavior that was supposed to be implemented by a prior feature but wasn't

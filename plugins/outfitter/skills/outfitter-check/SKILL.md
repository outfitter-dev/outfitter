---
name: outfitter-check
version: 0.1.0
description: "Verify Outfitter Stack compliance in a codebase. Scans for anti-patterns (throws, console, hardcoded paths) and produces a severity-ranked compliance report. Use for pre-commit checks, code review, or migration validation."
allowed-tools: Read, Grep, Glob, Bash(rg *), Bash(bun *)
---

# Outfitter Check

Verify Outfitter Stack compliance and produce a structured report.

## Goal

Scan a codebase and produce a Compliance Report at `.agents/notes/YYYY-MM-DD-outfitter-check.md` documenting:
1. What violations were found (by severity)
2. Where they are (file:line)
3. How to fix them (with pattern references)

## Constraints

**DO:**
- Load `outfitter-atlas` first for pattern knowledge
- Scan systematically using the diagnostic commands
- Rank findings by severity (Critical > High > Medium > Low)
- Reference fieldguide patterns for fixes
- Produce a Compliance Report at the end

**DON'T:**
- Skip categories during scanning
- Report issues without actionable guidance
- Mix severity levels (keep them separate)
- Forget to check the target scope (file, directory, or full codebase)

## Steps

1. Load `outfitter-atlas` for pattern expertise
2. [Determine scope](#step-1-determine-scope) — what are we checking?
3. [Run diagnostics](#step-2-run-diagnostics) — systematic anti-pattern scan
4. [Categorize findings](#step-3-categorize-findings) — rank by severity
5. [Produce report](#step-4-produce-report) — using [TEMPLATE.md](TEMPLATE.md)
6. [Migration guidance](#step-5-migration-guidance) — detect version gaps and compose upgrade instructions

## Step 1: Determine Scope

Ask or infer the target:

| Scope | When | Command Modifier |
|-------|------|------------------|
| Single file | "Check this file" | `rg PATTERN path/to/file.ts` |
| Directory | "Check src/handlers" | `rg PATTERN path/to/dir/` |
| Full codebase | "Check compliance" | `rg PATTERN --type ts` |

Exclude test files unless specifically requested:
```bash
rg PATTERN --type ts -g "!*.test.ts" -g "!__tests__/*"
```

## Step 2: Run Diagnostics

Run each scan and collect results.

### Critical: Exception Control Flow

```bash
# Thrown exceptions (must convert to Result)
rg "throw new" --type ts -g "!*.test.ts" -n

# try/catch control flow (must convert to Result checking)
rg "try \{" --type ts -g "!*.test.ts" -n
```

**Why critical**: Breaks type safety, loses error context, makes control flow unpredictable.

### High: Logging and Paths

```bash
# Console usage (must use ctx.logger)
rg "console\.(log|error|warn|info|debug)" --type ts -g "!*.test.ts" -n

# Hardcoded home paths (must use XDG via @outfitter/config)
rg "(homedir\(\)|~\/\.)" --type ts -g "!*.test.ts" -n
```

**Why high**: Console breaks structured logging; hardcoded paths break portability.

### Medium: Type Safety

```bash
# Custom error classes (should use taxonomy)
rg "class \w+Error extends Error" --type ts -n

# Handlers without context parameter
rg "Handler<.*> = async \(input\)" --type ts -n

# Missing Result type returns
rg "async.*Handler.*\{" --type ts -A 10 | rg "return [^R]" -B 5
```

**Why medium**: Reduces type safety and pattern consistency.

### Low: Style and Documentation

```bash
# process.exit without exitWithError
rg "process\.exit\(" --type ts -g "!*.test.ts" -n

# Missing .describe() on Zod schemas used with MCP
rg "z\.(string|number|boolean|object)\(\)(?!.*\.describe)" --type ts -n
```

**Why low**: Affects agent experience and exit code consistency.

## Step 3: Categorize Findings

Count results and assign severity:

| Severity | Findings | Action |
|----------|----------|--------|
| **Critical** | throw/try-catch in handlers | Must fix before merge |
| **High** | console.log, hardcoded paths | Should fix before merge |
| **Medium** | Custom errors, missing context | Fix when touching file |
| **Low** | Style issues, missing describe | Nice to have |

### Severity Definitions

| Level | Impact | Examples |
|-------|--------|----------|
| **Critical** | Breaks core patterns, causes runtime issues | Thrown exceptions, unvalidated paths |
| **High** | Breaks observability or portability | Console logging, hardcoded paths |
| **Medium** | Reduces type safety or consistency | Custom errors, missing context param |
| **Low** | Affects polish, not correctness | Style, documentation gaps |

## Step 4: Produce Report

Write the Compliance Report to `.agents/notes/YYYY-MM-DD-outfitter-check.md` using [TEMPLATE.md](TEMPLATE.md).

```bash
# Create directory if needed
mkdir -p .agents/notes

# Report path (replace YYYY-MM-DD with today's date)
# .agents/notes/2024-01-15-outfitter-check.md
```

### Pass Criteria

| Status | Criteria |
|--------|----------|
| **PASS** | 0 critical, 0 high |
| **WARNINGS** | 0 critical, 1+ high or medium |
| **FAIL** | 1+ critical |

### Quick Summary

```
## Compliance: [scope]

**Status**: PASS | WARNINGS | FAIL
**Issues**: X critical, Y high, Z medium, W low

[Details follow...]
```

## Fix References

Point to fieldguide patterns for each issue type:

| Issue | Fix Pattern |
|-------|-------------|
| `throw new` | [patterns/conversion.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/conversion.md) |
| `try/catch` | [patterns/results.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/results.md) |
| `console.log` | [patterns/logging.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/logging.md) |
| Hardcoded paths | [patterns/file-ops.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/file-ops.md) |
| Custom errors | [patterns/errors.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/errors.md) |
| Missing context | [patterns/handler.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/handler.md) |

## Quick Check

For a fast pass/fail without full report:

```bash
# Critical count (should be 0)
rg "throw new|try \{" --type ts -g "!*.test.ts" -c | wc -l

# High count (should be 0)
rg "console\.(log|error|warn)|homedir\(\)" --type ts -g "!*.test.ts" -c | wc -l
```

## Step 5: Migration Guidance

After the compliance scan, detect installed `@outfitter/*` versions and check for available migrations using the `outfitter update` command.

```bash
# Check for available updates (human-readable)
bunx outfitter update --guide --cwd .
```

For JSON output (version data only, does not include migration docs):

```bash
bunx outfitter update --json --cwd .
```

If updates are found, append a **Migration Guidance** section to the compliance report. If all packages are up to date, note that in the report.

The command:
1. Reads `package.json` for `@outfitter/*` dependencies
2. Queries npm for latest versions
3. When `--guide` is used, composes migration docs from the kit plugin's shared migrations

## Related Skills

- `outfitter-atlas` — Patterns and fix guidance (load first)
- `outfitter-start` — Full adoption workflow with staged plan
- `debug-outfitter` — Deep investigation of specific issues

---
name: outfitter-check
version: 0.1.0
description: "Verify Outfitter Stack compliance in a codebase. Scans for anti-patterns (throws, console, hardcoded paths) and produces a severity-ranked compliance report. Use for pre-commit checks, code review, or migration validation."
allowed-tools: Read Grep Glob Bash(rg *)
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
- Load `outfitter-fieldguide` first for pattern knowledge
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

1. Load `outfitter-stack:outfitter-fieldguide` for pattern expertise
2. [Determine scope](#step-1-determine-scope) — what are we checking?
3. [Run diagnostics](#step-2-run-diagnostics) — systematic anti-pattern scan
4. [Categorize findings](#step-3-categorize-findings) — rank by severity
5. [Produce report](#step-4-produce-report) — using [TEMPLATE.md](TEMPLATE.md)

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
| `throw new` | [patterns/conversion.md](../outfitter-fieldguide/patterns/conversion.md) |
| `try/catch` | [patterns/results.md](../outfitter-fieldguide/patterns/results.md) |
| `console.log` | [patterns/logging.md](../outfitter-fieldguide/patterns/logging.md) |
| Hardcoded paths | [patterns/file-ops.md](../outfitter-fieldguide/patterns/file-ops.md) |
| Custom errors | [patterns/errors.md](../outfitter-fieldguide/patterns/errors.md) |
| Missing context | [patterns/handler.md](../outfitter-fieldguide/patterns/handler.md) |

## Quick Check

For a fast pass/fail without full report:

```bash
# Critical count (should be 0)
rg "throw new|try \{" --type ts -g "!*.test.ts" -c | wc -l

# High count (should be 0)
rg "console\.(log|error|warn)|homedir\(\)" --type ts -g "!*.test.ts" -c | wc -l
```

## Related Skills

- `outfitter-stack:outfitter-fieldguide` — Patterns and fix guidance (load first)
- `outfitter-stack:outfitter-init` — Full adoption workflow with staged plan
- `outfitter-stack:debug-outfitter` — Deep investigation of specific issues

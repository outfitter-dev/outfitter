# Migration Assessment

Evaluate a codebase to determine adoption scope and approach.

## Decision Tree

```
Is this a new project with no existing code?
├─ Yes → Greenfield Path
│        Use templates directly, skip conversion stages
│
└─ No → Migration Path
         ├─ Run scanner to quantify scope
         ├─ Review audit report
         └─ Plan staged conversion
```

## Project Type Detection

### Greenfield Indicators

- No `throw` statements in application code
- No custom error classes
- No console logging (or only in entry points)
- No hardcoded home directory paths

### Migration Indicators

- Existing `throw new Error()` patterns
- Custom error classes extending `Error`
- `console.log/error/warn` throughout codebase
- `os.homedir()` or `~/` path references

### Partial Migration Indicators

- Some `Result` usage already present
- Mix of throw and Result patterns
- Some structured logging, some console

## Effort Estimation

### By Count

| Finding | Count | Effort |
|---------|-------|--------|
| Throw statements | 0 | None |
| | 1-5 | Low |
| | 6-15 | Medium |
| | 16+ | High |
| Try-catch blocks | 0-3 | Low |
| | 4-10 | Medium |
| | 11+ | High |
| Custom error classes | 0-2 | Low |
| | 3-5 | Medium |
| | 6+ | High |

### By Complexity

| Pattern | Complexity | Notes |
|---------|------------|-------|
| Simple throw | Low | Direct conversion to Result.err() |
| Conditional throw | Low | Map condition to error type |
| Try-catch with rethrow | Medium | Need to trace error flow |
| Nested try-catch | High | May need restructuring |
| Promise.all with throws | High | Need Result-aware alternative |
| Third-party library throws | Medium | Requires wrapper pattern |

## Scope Indicators

### High-Priority Conversion Candidates

Functions that:
- Are called from multiple places
- Handle user input
- Interact with external services
- Are on critical paths (auth, payments)

### Low-Priority Items

- Test utilities (can use throw)
- Build scripts (not runtime code)
- One-off scripts
- Development-only code

## Assessment Commands

Run these to quantify scope:

```bash
# Throw statements
rg "throw (new |[a-zA-Z])" --type ts -c

# Try-catch blocks
rg "(try \{|catch \()" --type ts -c

# Console usage
rg "console\.(log|error|warn|debug|info)" --type ts -c

# Custom error classes
rg "class \w+Error extends Error" --type ts

# Path patterns
rg "(homedir\(\)|os\.homedir|~/\.)" --type ts -c
```

## Assessment Report Template

```markdown
## Migration Assessment

**Project:** [name]
**Date:** [date]

### Scope Summary

| Category | Count | Effort |
|----------|-------|--------|
| Throw statements | X | Low/Medium/High |
| Try-catch blocks | X | Low/Medium/High |
| Console logging | X | Low/Medium/High |
| Custom errors | X | Low/Medium/High |
| Path patterns | X | Low/Medium/High |

### Recommended Approach

[ ] Greenfield — Use templates, no conversion needed
[ ] Quick migration — Low effort, ~X handlers to convert
[ ] Staged migration — Medium effort, plan by feature area
[ ] Major migration — High effort, allocate dedicated time

### Risk Areas

- [List complex patterns that need review]
- [Third-party libraries that throw]
- [High-traffic code paths]

### Next Steps

1. [Specific action items based on assessment]
```

## When to Use Scanner vs Manual

### Use Automated Scanner

- Projects with 10+ TypeScript files
- Unknown codebase scope
- Need accurate counts for planning
- Want generated task files

### Use Manual Assessment

- Small projects (<10 files)
- Quick scope check
- Verifying scanner results
- Targeted investigation

## Post-Assessment Decisions

After assessment, decide:

1. **Proceed with full migration** — Generate plan, work through stages
2. **Partial migration** — Convert critical paths only, document exceptions
3. **Defer migration** — Not the right time, document decision
4. **Greenfield approach** — Start fresh, migrate data only

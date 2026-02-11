# Compliance Report: {Scope}

**Date**: {YYYY-MM-DD}
**Scope**: {file | directory | codebase}
**Status**: {PASS | WARNINGS | FAIL}

## Summary

| Severity | Count |
|----------|-------|
| Critical | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |

## Critical

{If none: "None found."}

### {Issue Type}

| Location | Issue |
|----------|-------|
| `{file}:{line}` | {description} |

**Fix**: {Brief guidance + link to fieldguide pattern}

## High

{If none: "None found."}

### {Issue Type}

| Location | Issue |
|----------|-------|
| `{file}:{line}` | {description} |

**Fix**: {Brief guidance + link to fieldguide pattern}

## Medium

{If none: "None found."}

### {Issue Type}

| Location | Issue |
|----------|-------|
| `{file}:{line}` | {description} |

**Fix**: {Brief guidance + link to fieldguide pattern}

## Low

{If none: "None found." — can omit this section entirely if focusing on blockers}

## Migration Guidance

**Installed versions:**

| Package | Version |
|---------|---------|
| `{@outfitter/package}` | {version} |

**Updates available:**

| Package | Current | Available | Type |
|---------|---------|-----------|------|
| `{@outfitter/package}` | {current} | {available} | {minor (no breaking) | major (breaking)} |

**Migration guide:**

{Composed migration docs from `outfitter update --guide` output, or "All packages up to date."}

## Recommendations

{Prioritized list of what to fix first}

1. {Most important fix}
2. {Next priority}
3. {etc.}

## Pass Criteria

- [ ] 0 critical issues
- [ ] 0 high issues
- [ ] All handlers return `Result<T, E>`
- [ ] No `throw` in application code
- [ ] No `console.log` in production code

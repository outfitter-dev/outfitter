# Layout Context Implementation Plan

> Phase 1: Width Calculation Utilities

**Status**: Ready for implementation
**Date**: 2026-01-29

## Overview

Add width calculation utilities to `@outfitter/cli` enabling components to calculate available content width inside boxes. Follows TDD methodology.

## Implementation Steps

### Step 1: Write Tests (RED Phase)

Add tests to `packages/cli/src/__tests__/layout.test.ts`:

- `getTerminalWidth` (2 tests)
- `getContentWidth` (6 tests)
- `getBoxOverhead` (4 tests)
- `normalizePadding` (3 tests)
- `normalizeBorders` (2 tests)

Total: ~17 new tests

### Step 2: Export from `box.ts`

Export internal types and functions:

```typescript
export interface NormalizedSpacing { ... }
export interface NormalizedBorders { ... }
export function normalizePadding(...) { ... }
export function normalizeBorders(...) { ... }
```

### Step 3: Add utilities to `layout.ts`

```typescript
export function getTerminalWidth(): number;
export function getContentWidth(options: BoxOptions): number;
export function getBoxOverhead(options: BoxOptions): { horizontal: number; vertical: number };
```

### Step 4: Update `index.ts` exports

Add new exports from both `box.ts` and `layout.ts`.

### Step 5: Run Tests (GREEN Phase)

```bash
bun test packages/cli/src/__tests__/layout.test.ts
```

### Step 6: Refactor

Review for consistency, documentation, edge cases.

### Step 7: Add Demo

Extend `packages/cli/src/demo/renderers/layout.ts` with width utility examples.

## Files to Modify

| File | Changes |
|------|---------|
| `render/box.ts` | Export normalization helpers |
| `render/layout.ts` | Add width utilities |
| `render/index.ts` | Export new utilities |
| `__tests__/layout.test.ts` | Add tests |
| `demo/renderers/layout.ts` | Add demo section |

## Dependencies

```
Tests → box.ts exports → layout.ts utilities → index.ts exports → Demo
```

## Validation

```bash
bun test packages/cli/src/__tests__/layout.test.ts  # Tests pass
bun run build --filter=@outfitter/cli              # Build succeeds
out demo layout                                     # Demo shows utilities
```

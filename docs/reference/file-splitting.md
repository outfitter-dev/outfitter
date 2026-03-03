# File Splitting with `src/internal/`

When package source files grow beyond the `max-file-lines` thresholds (warn: 200, error: 400), extract implementation details into `src/internal/` modules. These modules are automatically excluded from the public `package.json#exports` surface.

## Why `src/internal/`?

Bunup's `exports: true` auto-discovers all `src/**/*.ts` files as public exports. Without guardrails, splitting a large file creates new public API by accident. The `src/internal/` convention solves this: any file under that directory is implementation-only and never published.

## Split Recipe

1. Create `src/internal/` in the package if it doesn't exist
2. Move implementation details into `src/internal/<module>.ts`
3. Import from the internal module in the original file
4. Run `bun run build` — the internal module is excluded automatically
5. Verify: `bun scripts/normalize-exports.ts --check`

The original file becomes a thin barrel that re-exports the public API while delegating to internal modules.

## Two-Layer Defense

Export leakage is prevented at two points:

### Layer 1: Build-time — `withDefaults()` in `bunup.config.ts`

Every workspace entry uses `withDefaults()`, which unions `["./internal", "./internal/*"]` into the package's `exports.exclude`. This tells bunup to skip internal files when generating exports.

### Layer 2: Post-build — `scripts/normalize-exports.ts`

As a safety net, the normalize-exports script strips any `./internal` or `./internal/*` keys that slip through. This catches edge cases where bunup config is misconfigured or a new package forgets to use `withDefaults()`.

## Example

### Before: single 450-line file

```
packages/schema/src/introspect.ts  (450 lines)
```

### After: split with internal module

```
packages/schema/src/introspect.ts           (80 lines — public barrel)
packages/schema/src/internal/introspect.ts  (370 lines — implementation)
```

**`src/introspect.ts`** (the public entrypoint):

```typescript
export { introspectSchema, type SchemaMap } from "./internal/introspect.js";
```

**`src/internal/introspect.ts`** (the implementation):

```typescript
// Full implementation lives here — never appears in package.json#exports
export function introspectSchema(/* ... */) {
  /* ... */
}
export type SchemaMap = {
  /* ... */
};
```

## Related

- [Export Contracts](./export-contracts.md) — Full export pipeline and verification
- [Patterns](./patterns.md) — Handler contract and Result types

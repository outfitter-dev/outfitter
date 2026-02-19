---
paths:
  - "packages/*/src/**/*.ts"
---

# TSDoc Convention

All exported declarations in `packages/*/src/` require TSDoc comments. This enables agent comprehension and generated API reference docs.

## What Requires TSDoc

Every exported function, class, interface, type alias, and enum must have a TSDoc comment. Re-exports from barrel files (`export { foo } from "./foo.js"`) do not need TSDoc at the re-export site — document at the definition.

## Quality Bar

- **Description** — First line is a concise summary of what the declaration does
- **`@param`** — Document non-obvious parameters (skip `options` bags where Zod schema is self-documenting)
- **`@returns`** — Document non-void return values, especially `Result<T, E>` types
- **`@example`** — Required for public API entry points (functions users import directly)

## Standard

Use TSDoc syntax. Do not include JSDoc-style `{type}` annotations — TypeScript types handle that.

```typescript
// Good
/** @param name - The user's display name */

// Bad — redundant type annotation
/** @param {string} name - The user's display name */
```

## Examples

### Exported function

```typescript
/**
 * Load configuration from XDG-compliant paths with schema validation.
 *
 * @param appName - Application name used as subdirectory under XDG paths
 * @param schema - Zod schema to validate the loaded configuration
 * @returns Result containing validated config or a ConfigError
 *
 * @example
 * ```typescript
 * const result = await loadConfig("myapp", AppConfigSchema);
 * if (result.isOk()) {
 *   console.log(result.value.apiKey);
 * }
 * ```
 */
export async function loadConfig<T>(
  appName: string,
  schema: ZodSchema<T>,
): Promise<Result<T, ConfigError>> { ... }
```

### Exported interface

```typescript
/**
 * Options for the check-exports command.
 */
export interface CheckExportsOptions {
  /** Output results as JSON instead of human-readable format. */
  readonly json?: boolean;
}
```

### Exported type alias

```typescript
/** Handler function that processes input and returns a Result. */
export type Handler<TInput, TOutput, TError extends OutfitterError = OutfitterError> = (
  input: TInput,
  ctx: HandlerContext,
) => Promise<Result<TOutput, TError>>;
```

### Package entry point (`index.ts`)

```typescript
/**
 * @outfitter/config
 *
 * XDG-compliant configuration loading with schema validation.
 *
 * @example
 * ```typescript
 * import { loadConfig } from "@outfitter/config";
 * ```
 *
 * @packageDocumentation
 */
```

## Exemplary Packages

Reference these packages for TSDoc patterns: `config`, `logging`, `state`.

## Verification

Run `bunx @outfitter/tooling check-tsdoc` to report coverage. Use `--strict` to fail on missing docs.

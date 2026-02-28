# Architecture

Architectural decisions, patterns discovered during this mission.

**What belongs here:** Design decisions, discovered patterns, cross-package interaction notes.

---

## Package Tiers

Foundation (stable) -> Runtime (active) -> Tooling (early). Dependencies flow downward only.

## Handler Contract

All domain logic returns `Result<T, E>` via `better-result`. CLI and MCP are thin adapters.

```typescript
type Handler<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
> = (input: TInput, ctx: HandlerContext) => Promise<Result<TOutput, TError>>;
```

## Error Taxonomy

10 categories with exit code + HTTP status mappings in `packages/contracts/src/errors.ts`:
`validation(1/400)`, `not_found(2/404)`, `conflict(3/409)`, `permission(4/403)`, `timeout(5/504)`, `rate_limit(6/429)`, `network(7/502)`, `internal(8/500)`, `auth(9/401)`, `cancelled(130/499)`.

Each category also has JSON-RPC code (`jsonRpcCodeMap`) and retryable flag (`retryableMap`) for MCP protocol compliance and agent safety. Use `errorCategoryMeta(category)` to get all four fields (`exitCode`, `statusCode`, `jsonRpcCode`, `retryable`) in one call.

## Build Pipeline: normalize-exports

The build pipeline (`bunup`) auto-runs a `normalize-exports` post-build step that mutates `package.json` export maps — reordering entries and adding new subpath exports for any new source entry points. This is expected behavior. When adding a new source file that becomes a build entry point, the resulting `package.json` changes in the commit diff include both the manually-added export AND auto-generated reordering from normalize-exports.

## CommandBuilder Pattern (v0.5 target)

Current CommandBuilder API (packages/cli/src/command.ts):

- `.description(text)`, `.option(flags, desc, default?)`, `.requiredOption(flags, desc, default?)`
- `.alias(alias)`, `.preset(preset: FlagPreset)`, `.action(handler)`, `.build()`

Current `.action()` handler receives `{ args, flags, command }`. `.preset()` accepts `FlagPreset` with options array and resolve function.

v0.5 adds: `.input(schema)`, `.context(factory)`, `.hints(fn)`, `.onError(fn)` + `runHandler()` bridge + `createSuccessEnvelope()` / `createErrorEnvelope()` (in `packages/cli/src/envelope.ts`).

Key design: `.input(schema)` auto-derives Commander flags from Zod schema (80% case). Explicit declarations override/supplement. `.context(factory)` receives typed input post-validation. `.hints()/.onError()` are transport-local (not in handler).

## MCP Resource Support (existing)

`packages/mcp/src/server.ts` already has: `registerResource()`, `registerResourceTemplate()`, `readResource()`, `subscribe/unsubscribe/notify`. Types: `ResourceDefinition`, `ResourceTemplateDefinition`. v0.5 adds `defineResource()` convenience with Zod schema validation (parallel to `defineTool()`).

## Config Loading

`packages/config/src/index.ts` has `loadConfig(appName, schema, options?)` returning synchronous `Result`. v0.5 makes schema optional via TypeScript overloads.

## Output Mode Resolution

Centralized in `packages/cli/src/query.ts` via `resolveOutputMode()` (completed in OS-421). Returns `{ mode, source }` where source tracks whether resolution came from an explicit flag, env var, or default. All action groups delegate to this single resolver — no per-action env-var detection or explicitness-checking branches remain. The legacy files `apps/outfitter/src/actions/docs-output-mode.ts` and per-action resolution in `apps/outfitter/src/actions/shared.ts` were removed.

---
package: "@outfitter/contracts"
version: 0.2.1
breaking: false
---

# @outfitter/contracts → 0.2.1

## New APIs

### Backend-Agnostic Logger Factory Contract

`@outfitter/contracts` now provides logger factory abstractions for runtime
packages that need pluggable logging backends:

- `Logger`
- `LoggerAdapter<TBackendOptions>`
- `LoggerFactory<TBackendOptions>`
- `LoggerFactoryConfig<TBackendOptions>`
- `createLoggerFactory(adapter)`

```typescript
import {
  createLoggerFactory,
  type LoggerAdapter,
} from "@outfitter/contracts";

const adapter: LoggerAdapter = {
  createLogger(config) {
    return myBackend.create(config);
  },
};

const factory = createLoggerFactory(adapter);
const logger = factory.createLogger({ name: "mcp" });
await factory.flush();
```

### `AlreadyExistsError`

Use `AlreadyExistsError` for create/write conflicts where a specific resource is
already present.

```typescript
import { AlreadyExistsError } from "@outfitter/contracts";

return Result.err(
  AlreadyExistsError.create("file", "notes/meeting.md", {
    scope: "workspace",
  })
);
```

`AlreadyExistsError` maps to category `conflict` (exit code `3`, HTTP `409`).

### Serialization Support for `AlreadyExistsError`

`serializeError()` and `deserializeError()` now round-trip
`AlreadyExistsError`, including `resourceType`, `resourceId`, and custom
context.

## Migration Steps

### Use `AlreadyExistsError` for Duplicate Resource Cases

**Before:**

```typescript
return Result.err(ConflictError.create("File already exists"));
```

**After:**

```typescript
return Result.err(AlreadyExistsError.create("file", path));
```

Use `ConflictError` for state divergence (ETag/version mismatch, concurrent
writes), and `AlreadyExistsError` for identity collisions.

### Update Exhaustive Error Matching

If you pattern-match by `_tag`, include the new tag:

```typescript
switch (error._tag) {
  case "AlreadyExistsError":
    // Handle duplicate resource response
    break;
}
```

### Adopt Contracts Logger Factory in Runtime Packages

If your runtime package previously owned a custom logger factory interface,
migrate to contracts types to keep CLI/MCP integrations transport-agnostic.

## No Action Required

- Existing error categories and exit/status mappings are unchanged
- Existing `ConflictError` behavior is unchanged
- Existing `Result` and handler contracts are unchanged

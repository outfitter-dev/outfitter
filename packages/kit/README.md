# @outfitter/kit

Foundation facade for Outfitter.

`@outfitter/kit` provides a single foundation entrypoint over:

- `@outfitter/contracts`
- `@outfitter/types`

Runtime and transport packages (`@outfitter/cli`, `@outfitter/mcp`, etc.) remain explicit dependencies.

## Install

```bash
bun add @outfitter/kit
```

## Root Facade

The root entrypoint re-exports the contracts surface and exposes types under a namespace.

```typescript
import { Result, ValidationError, Types } from "@outfitter/kit";

const value = Result.ok({ id: Types.shortId() });
```

## Foundation Subpaths

Use subpaths when you want explicit import intent.

### Contracts

```typescript
import { Result, createLoggerFactory } from "@outfitter/kit/foundation/contracts";
```

### Types

```typescript
import { shortId, isDefined } from "@outfitter/kit/foundation/types";
```

### Aggregate Foundation

```typescript
import { Result, Types } from "@outfitter/kit/foundation";
```

## What Kit Does Not Hide

`@outfitter/kit` does not implicitly install or expose runtime transports.
Keep transport dependencies explicit in your app:

```bash
bun add @outfitter/kit @outfitter/cli @outfitter/mcp
```

## License

MIT

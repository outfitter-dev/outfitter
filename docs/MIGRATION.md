# Migration Guide

How to adopt Outfitter patterns in existing projects and upgrade between versions.

## Adoption IA

Before choosing an adoption path, review:

- [Mixed Adoption IA](./ADOPTION-IA.md)
- [Pilot Report: Kit-First Adoption](./PILOT-KIT-FIRST-ADOPTION.md)

It defines the current three-state model (baseline foundation, baseline +
transport, granular runtime adoption), a final recommendation, and explicit
cross-workstream mapping for:

- Logging slices: OS-78 .. OS-84
- Kit/create/adoption slices: OS-85 .. OS-92

## Adopting Outfitter

### From Raw Commander.js to @outfitter/cli

**Before** — Manual Commander setup with ad-hoc error handling:

```typescript
import { Command } from "commander";

const program = new Command();

program
  .command("list")
  .option("-l, --limit <n>", "Limit results")
  .action(async (options) => {
    try {
      const results = await listItems(options.limit);
      console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });

program.parse();
```

**After** — Outfitter CLI with typed commands and automatic output handling:

```typescript
import { createCLI, command } from "@outfitter/cli/command";
import { output, exitWithError } from "@outfitter/cli/output";
import { createContext } from "@outfitter/contracts";
import { listItems } from "./handlers/list-items.js";

const cli = createCLI({
  name: "myapp",
  version: "1.0.0",
});

cli.program.addCommand(
  command("list")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action(async ({ flags }) => {
      const ctx = createContext({});
      const result = await listItems({ limit: flags.limit }, ctx);

      if (result.isErr()) {
        exitWithError(result.error); // Auto exit code from error category
      }

      await output(result.value); // Human by default; use --json for machine output
    })
    .build()
);

cli.program.parse();
```

**Key changes:**

1. Wrap handler logic in a `Handler` function returning `Result`
2. Use `createContext()` for cross-cutting concerns
3. Use `output()` for automatic format detection
4. Use `exitWithError()` for consistent exit codes

### From Thrown Errors to Result Types

**Before** — Throwing errors:

```typescript
async function getUser(id: string): Promise<User> {
  const user = await db.users.findById(id);
  if (!user) {
    throw new Error(`User not found: ${id}`);
  }
  return user;
}

// Usage
try {
  const user = await getUser("123");
} catch (error) {
  // What type is error? Unknown.
  console.error(error.message);
}
```

**After** — Returning Results:

```typescript
import { Result, NotFoundError, type Handler } from "@outfitter/contracts";

const getUser: Handler<{ id: string }, User, NotFoundError> = async (input, ctx) => {
  const user = await db.users.findById(input.id);
  if (!user) {
    return Result.err(NotFoundError.create("user", input.id));
  }
  return Result.ok(user);
};

// Usage
const result = await getUser({ id: "123" }, ctx);

if (result.isErr()) {
  // TypeScript knows result.error is NotFoundError
  ctx.logger.warn("User not found", { userId: result.error.resourceId });
}
```

**Key changes:**

1. Return `Result.ok(value)` instead of `return value`
2. Return `Result.err(error)` instead of `throw error`
3. Use typed error classes from `@outfitter/contracts`
4. Check `result.isOk()` / `result.isErr()` instead of try/catch

### From Custom Errors to Error Taxonomy

**Before** — Ad-hoc error classes:

```typescript
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

class ValidationError extends Error {
  details: unknown;
  constructor(message: string, details: unknown) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}
```

**After** — Outfitter error taxonomy:

```typescript
import { NotFoundError, ValidationError } from "@outfitter/contracts";

// NotFoundError includes resourceType and resourceId
NotFoundError.create("user", "user-123");
// .message = "user not found: user-123"
// .category = "not_found"
// ._tag = "NotFoundError"

// ValidationError includes structured details
ValidationError.create("email", "Invalid format");
// .category = "validation"
// ._tag = "ValidationError"
// .field = "email"
```

**Key changes:**

1. Import error classes from `@outfitter/contracts`
2. Errors have `category` for automatic exit/status code mapping
3. Errors have `_tag` for exhaustive pattern matching
4. Use typed constructors with structured data

### From console.log to Structured Logging

**Before** — Console logging:

```typescript
console.log("Processing request", requestId);
console.error("Failed to process:", error.message);
console.log("Config:", JSON.stringify(config)); // May leak secrets!
```

**After** — Structured logging with redaction:

```typescript
import { createLogger, createConsoleSink } from "@outfitter/logging";

const logger = createLogger({
  name: "myapp",
  level: "info",
  sinks: [createConsoleSink()],
  redaction: { enabled: true },
});

logger.info("Processing request", { requestId });
logger.error("Failed to process", { error, requestId });
logger.debug("Config loaded", { config }); // Secrets auto-redacted
```

**Key changes:**

1. Create a logger instance with `createLogger()`
2. Use log level methods: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
3. Pass structured metadata as second argument
4. Sensitive fields are automatically redacted

### Logging API Migration (Message-First)

If you're coming from Pino or another object-first logger, use the
[Logging Migration Guide](./LOGGING-MIGRATION.md) to translate patterns.

### From Manual Paths to XDG Compliance

**Before** — Hardcoded paths:

```typescript
const configPath = path.join(os.homedir(), ".myapp", "config.json");
const cachePath = path.join(os.homedir(), ".myapp", "cache");
```

**After** — XDG-compliant paths:

```typescript
import { getConfigDir, getCacheDir, getStateDir } from "@outfitter/config";

const configDir = getConfigDir("myapp");  // ~/.config/myapp
const cacheDir = getCacheDir("myapp");    // ~/.cache/myapp
const stateDir = getStateDir("myapp");    // ~/.local/state/myapp
```

**Key changes:**

1. Use `@outfitter/config` path helpers
2. Respects `XDG_*_HOME` environment variables
3. Paths are user-configurable and predictable

## Version Upgrades

For current package upgrades, use:

```bash
outfitter update
outfitter update --guide
```

`--guide` composes package migration docs from
`plugins/kit/shared/migrations/` for versions between your installed package and
the target release.

### 0.2.x to 0.3.0 (Runtime Packages)

The current runtime upgrade path to `0.3.0` covers:

- `@outfitter/cli`
- `@outfitter/config`
- `@outfitter/logging`
- `@outfitter/mcp`

High-impact changes:

1. Unified environment profiles via `OUTFITTER_ENV`
2. Standardized precedence for log level and verbose defaults
3. Global `--json` support at the CLI root
4. Explicit human-first output defaults (machine output is opt-in)
5. MCP client log forwarding controls via `defaultLogLevel` and
   `sendLogMessage()`

### Contracts Patch Track (Ahead-of-Time)

An ahead-of-time migration doc is included for `@outfitter/contracts` `0.2.1`
to document:

1. Logger factory contract abstractions
2. `AlreadyExistsError` for duplicate-resource conflicts
3. Serialization support for the new error tag

## Upgrade Checklist

When upgrading Outfitter packages:

- [ ] Update all `@outfitter/*` packages together (use `@outfitter/kit` for version coordination)
- [ ] Run `bun install` to update lockfile
- [ ] Run `bun run typecheck` to catch type errors
- [ ] Run `bun run test` to verify functionality
- [ ] Review changelog for each package
- [ ] Update any deprecated API usage

## Getting Help

- **Package READMEs** — Detailed API documentation for each package
- **[Architecture](./ARCHITECTURE.md)** — Understanding package relationships
- **[Patterns](./PATTERNS.md)** — Common conventions and idioms
- **GitHub Issues** — Report bugs or request features

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — How packages fit together
- [Getting Started](./GETTING-STARTED.md) — Hands-on tutorials
- [Patterns](./PATTERNS.md) — Common conventions

---
name: migration
version: 0.1.0
description: Audits existing code and recommends migration paths to Outfitter Stack patterns. Use when adopting the stack in an existing project, converting throw to Result, migrating console to structured logging, or when "migrate", "adopt stack", "convert to Result", or "upgrade to outfitter" are mentioned.
allowed-tools: Read Write Edit Grep Glob Bash(rg *) Bash(bun *) Bash(mkdir *)
---

# Stack Migration

Structured migration from existing patterns to Outfitter Stack.

## Quick Start

Run the scanner to generate a migration plan:

```bash
bun run path/to/skills/migration/scripts/init-migration.ts
```

This creates `.outfitter/migration/` with:
- `audit-report.md` — Scan results and scope
- `plan/` — Stage-by-stage task files

## Generated Structure

```
.outfitter/migration/
├── audit-report.md           # Scan results, scope, recommendations
└── plan/
    ├── 00-overview.md        # Status dashboard, dependencies
    ├── 01-foundation.md      # Dependencies, context, logger
    ├── 02-handlers.md        # Handler conversions
    ├── 03-errors.md          # Error taxonomy mappings
    ├── 04-paths.md           # XDG path migrations
    ├── 05-adapters.md        # CLI/MCP transport layers
    ├── 06-documents.md       # Documentation updates
    └── 99-unknowns.md        # Items requiring review
```

## Migration Stages

| Stage | Blocked By | Focus |
|-------|------------|-------|
| 1. Foundation | — | Install packages, create context/logger |
| 2. Handlers | Foundation | Convert throw → Result |
| 3. Errors | Handlers | Map to error taxonomy |
| 4. Paths | — | XDG paths, securePath |
| 5. Adapters | Handlers | CLI/MCP wrappers |
| 6. Documents | All | Update docs to reflect patterns |
| 99. Unknowns | — | Review anytime |

## Conversion Patterns

### Exceptions to Result

**Before:**
```typescript
async function getUser(id: string): Promise<User> {
  const user = await db.users.findById(id);
  if (!user) throw new Error(`Not found: ${id}`);
  return user;
}
```

**After:**
```typescript
import { Result, NotFoundError, type Handler } from "@outfitter/contracts";

const getUser: Handler<{ id: string }, User, NotFoundError> = async (input, ctx) => {
  const user = await db.users.findById(input.id);
  if (!user) return Result.err(new NotFoundError("user", input.id));
  return Result.ok(user);
};
```

### Console to Structured Logging

**Before:**
```typescript
console.log("Processing", userId);
```

**After:**
```typescript
ctx.logger.info("Processing", { userId });
```

### Hardcoded Paths to XDG

**Before:**
```typescript
const configPath = path.join(os.homedir(), ".myapp", "config.json");
```

**After:**
```typescript
import { getConfigDir } from "@outfitter/config";
const configPath = path.join(getConfigDir("myapp"), "config.json");
```

## Error Taxonomy

| Original | Outfitter | Category |
|----------|-----------|----------|
| `NotFoundError` | `NotFoundError` | `not_found` |
| `InvalidInputError` | `ValidationError` | `validation` |
| `DuplicateError` | `ConflictError` | `conflict` |
| `UnauthorizedError` | `AuthError` | `auth` |
| `ForbiddenError` | `PermissionError` | `permission` |
| Generic `Error` | `InternalError` | `internal` |

## Migration Strategy

1. **New code first** — All new code uses stack patterns
2. **Leaf functions** — Start with functions that don't call others
3. **Bottom-up** — Migrate dependencies before dependents
4. **Feature boundaries** — Complete one feature at a time

## Compatibility Layer

Wrap legacy code during transition:

```typescript
import { Result, InternalError } from "@outfitter/contracts";

function wrapLegacy<T>(fn: () => Promise<T>): Promise<Result<T, InternalError>> {
  return fn()
    .then((value) => Result.ok(value))
    .catch((error) => Result.err(new InternalError(error.message, { cause: error })));
}
```

## Reporting Issues

If migration reveals problems with @outfitter/* packages, use the `stack:migration-feedback` skill to create GitHub issues on outfitter-dev/outfitter.

Categories:
- **bug** — Package behavior doesn't match expected
- **enhancement** — Missing feature that would help migration
- **docs** — Documentation unclear or missing
- **unclear-pattern** — How to handle specific scenario

## Related Skills

- `stack:patterns` — Target patterns reference
- `stack:review` — Verify migration completeness
- `stack:scaffold` — Templates for new components
- `stack:migration-feedback` — Report issues to stack repo

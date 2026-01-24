# @outfitter/state

Pagination cursor persistence and ephemeral state management for CLI and MCP workflows.

## Installation

```bash
bun add @outfitter/state
```

## Quick Start

```typescript
import {
  createCursor,
  createCursorStore,
  createScopedStore,
  advanceCursor,
} from "@outfitter/state";

// Create in-memory cursor store
const store = createCursorStore();

// Create a cursor for pagination
const cursorResult = createCursor({
  position: 0,
  metadata: { query: "status:open" },
  ttl: 60 * 60 * 1000, // 1 hour expiry
});

if (cursorResult.isOk()) {
  const cursor = cursorResult.value;
  store.set(cursor);

  // Later: advance cursor position
  const advanced = advanceCursor(cursor, 10);
  store.set(advanced);
}
```

## Cursor Design

Cursors are intentionally **opaque** to consumers. They are immutable, frozen objects that encapsulate pagination state.

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier for storage lookup |
| `position` | `number` | Current offset in the result set |
| `metadata` | `Record<string, unknown>` | Optional user-defined context |
| `ttl` | `number` | Time-to-live in milliseconds (optional) |
| `expiresAt` | `number` | Computed Unix timestamp for expiry (if TTL set) |
| `createdAt` | `number` | Unix timestamp when cursor was created |

### Why Opaque?

Cursors are frozen (`Object.freeze()`) to prevent direct mutation. This design:

1. **Enforces immutability** - Use `advanceCursor()` to create new positions
2. **Enables future changes** - Internal representation can evolve without breaking API
3. **Prevents corruption** - No accidental modification of cursor state

```typescript
const result = createCursor({ position: 0 });
if (result.isOk()) {
  const cursor = result.value;

  // This throws in strict mode (cursor is frozen)
  cursor.position = 10; // TypeError!

  // Do this instead
  const advanced = advanceCursor(cursor, 10);
}
```

## Pagination Flow

```
+-----------------------------------------------------+
|  First Request                                      |
|  1. Handler receives no cursor                      |
|  2. Creates cursor at position 0                    |
|  3. Returns items[0..limit] + cursor.id             |
+-----------------------------------------------------+
                         |
                         v
+-----------------------------------------------------+
|  Subsequent Requests                                |
|  1. Handler receives cursor.id                      |
|  2. Loads cursor from store                         |
|  3. Returns items[cursor.position..position+limit]  |
|  4. Advances cursor, saves back to store            |
+-----------------------------------------------------+
```

### Example: Paginated Handler

```typescript
import { createCursor, createCursorStore, advanceCursor } from "@outfitter/state";
import { Result } from "@outfitter/contracts";

const store = createCursorStore();
const PAGE_SIZE = 20;

async function listItems(cursorId?: string) {
  let cursor;

  if (cursorId) {
    // Load existing cursor
    const cursorResult = store.get(cursorId);
    if (cursorResult.isErr()) {
      return Result.err(cursorResult.error);
    }
    cursor = cursorResult.value;
  } else {
    // Create new cursor at position 0
    const cursorResult = createCursor({
      position: 0,
      ttl: 30 * 60 * 1000, // 30 minutes
    });
    if (cursorResult.isErr()) {
      return Result.err(cursorResult.error);
    }
    cursor = cursorResult.value;
    store.set(cursor);
  }

  // Fetch items at cursor position
  const items = await fetchItems(cursor.position, PAGE_SIZE);

  // Advance cursor for next page
  const advanced = advanceCursor(cursor, cursor.position + PAGE_SIZE);
  store.set(advanced);

  return Result.ok({
    items,
    nextCursor: items.length === PAGE_SIZE ? cursor.id : undefined,
  });
}
```

## State Scoping

Isolate cursors by namespace to prevent ID collisions between different contexts:

```typescript
const store = createCursorStore();

// Scoped stores for different contexts
const issuesStore = createScopedStore(store, "linear:issues");
const prsStore = createScopedStore(store, "github:prs");

// Cursors are isolated - same ID won't conflict
issuesStore.set(issueCursor);  // Stored as "linear:issues:cursor-id"
prsStore.set(prCursor);        // Stored as "github:prs:cursor-id"

// Each scope manages its own cursors
issuesStore.clear();  // Only clears issue cursors
```

### Nested Scopes

Scopes can be nested for hierarchical organization:

```typescript
const store = createCursorStore();
const githubStore = createScopedStore(store, "github");
const issuesStore = createScopedStore(githubStore, "issues");
const prsStore = createScopedStore(githubStore, "prs");

issuesStore.getScope();  // "github:issues"
prsStore.getScope();     // "github:prs"
```

### Scoped Store Behavior

When you retrieve a cursor from a scoped store, the ID is presented without the prefix:

```typescript
const scoped = createScopedStore(store, "my-scope");

const cursor = createCursor({ id: "abc123", position: 0 });
if (cursor.isOk()) {
  scoped.set(cursor.value);

  // Underlying store has prefixed ID
  store.list();  // ["my-scope:abc123"]

  // Scoped store returns clean ID
  scoped.list();  // ["abc123"]

  // Get returns cursor with clean ID
  const result = scoped.get("abc123");
  if (result.isOk()) {
    result.value.id;  // "abc123" (not "my-scope:abc123")
  }
}
```

## Persistent Storage

For cursors that need to survive process restarts:

```typescript
import { createPersistentStore } from "@outfitter/state";

// Create store that persists to disk
const store = await createPersistentStore({
  path: "/path/to/cursors.json",
});

// Use like any cursor store
store.set(cursor);

// Flush to disk before exit
await store.flush();

// Cleanup resources
store.dispose();
```

### Persistence Details

- **Format**: JSON file with `{ cursors: Record<string, Cursor> }` structure
- **Atomic writes**: Uses temp file + rename to prevent corruption
- **Auto-creates directories**: Parent directories created if they don't exist
- **Graceful degradation**: Corrupted files result in empty store (no crash)

### Example: Persistent Scoped Store

```typescript
import { createPersistentStore, createScopedStore } from "@outfitter/state";

const persistent = await createPersistentStore({
  path: "~/.config/myapp/cursors.json",
});

const issuesCursors = createScopedStore(persistent, "issues");
const prsCursors = createScopedStore(persistent, "prs");

// Use scoped stores normally
issuesCursors.set(cursor);

// Flush persists all scopes
await persistent.flush();
```

## TTL and Expiration

Cursors can have a time-to-live (TTL) for automatic expiration:

```typescript
// Cursor expires in 1 hour
const result = createCursor({
  position: 0,
  ttl: 60 * 60 * 1000,
});

if (result.isOk()) {
  const cursor = result.value;
  cursor.ttl;       // 3600000
  cursor.expiresAt; // Unix timestamp (e.g., 1706000000000)
}
```

### Expiration Behavior

- **`store.get()`**: Returns `NotFoundError` for expired cursors
- **`store.has()`**: Returns `false` for expired cursors
- **`isExpired()`**: Check expiration without store lookup
- **`store.prune()`**: Remove all expired cursors, returns count

```typescript
import { isExpired } from "@outfitter/state";

// Manual expiration check
if (isExpired(cursor)) {
  console.log("Cursor has expired");
}

// Prune expired cursors periodically
const prunedCount = store.prune();
console.log(`Removed ${prunedCount} expired cursors`);
```

### Cursors Without TTL

Cursors created without a TTL never expire:

```typescript
const result = createCursor({ position: 0 });
if (result.isOk()) {
  result.value.ttl;       // undefined
  result.value.expiresAt; // undefined
  isExpired(result.value); // always false
}
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `createCursor(options)` | Create a new immutable pagination cursor |
| `advanceCursor(cursor, position)` | Create a new cursor with updated position |
| `isExpired(cursor)` | Check if a cursor has expired |
| `createCursorStore()` | Create an in-memory cursor store |
| `createPersistentStore(options)` | Create a disk-backed cursor store |
| `createScopedStore(store, scope)` | Create a namespace-isolated cursor store |

### Interfaces

| Interface | Description |
|-----------|-------------|
| `Cursor` | Immutable pagination cursor |
| `CreateCursorOptions` | Options for `createCursor()` |
| `CursorStore` | Base interface for cursor stores |
| `ScopedStore` | Cursor store with namespace isolation |
| `PersistentStore` | Cursor store with disk persistence |
| `PersistentStoreOptions` | Options for `createPersistentStore()` |

## Error Handling

All functions that can fail return `Result<T, E>` from `@outfitter/contracts`:

```typescript
import { Result } from "@outfitter/contracts";

const result = createCursor({ position: -1 });

if (result.isErr()) {
  // ValidationError: Position must be non-negative
  console.error(result.error.message);
}

const getResult = store.get("nonexistent");

if (getResult.isErr()) {
  // NotFoundError: Cursor not found: nonexistent
  console.error(getResult.error.message);
  console.log(getResult.error.resourceType); // "cursor"
  console.log(getResult.error.resourceId);   // "nonexistent"
}
```

## License

MIT

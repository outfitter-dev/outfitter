# File Operations Patterns

Deep dive into @outfitter/file-ops patterns for workspace detection, path security, glob matching, file locking, and atomic writes.

## Workspace Detection

### Find Workspace Root

Search upward from a path for marker files (`.git`, `package.json` by default):

```typescript
import { findWorkspaceRoot } from "@outfitter/file-ops";

const result = await findWorkspaceRoot("/path/to/some/file.ts");
if (result.isOk()) {
  console.log(result.value); // "/path/to" (where .git lives)
}

// Custom markers and stop boundary
const result2 = await findWorkspaceRoot("/deep/nested/path", {
  markers: [".git", "deno.json", "Cargo.toml"],
  stopAt: "/deep",
});
```

**Signature:** `findWorkspaceRoot(startPath: string, options?: FindWorkspaceRootOptions) → Promise<Result<string, NotFoundError>>`

### Get Relative Path

Convert an absolute path to workspace-relative with forward slashes:

```typescript
import { getRelativePath } from "@outfitter/file-ops";

const result = await getRelativePath("/workspace/src/index.ts");
// → "src/index.ts"
```

**Signature:** `getRelativePath(absolutePath: string) → Promise<Result<string, NotFoundError>>`

### Check Workspace Membership

```typescript
import { isInsideWorkspace } from "@outfitter/file-ops";

isInsideWorkspace("/workspace/src/file.ts", "/workspace");  // true
isInsideWorkspace("/other/path", "/workspace");              // false
```

**Signature:** `isInsideWorkspace(path: string, workspaceRoot: string) → boolean`

## Path Security

Prevent path traversal attacks when handling user-provided paths.

### securePath

Validates a relative path and resolves it within a base directory. Returns `Result<string, ValidationError>` — does **not** throw.

```typescript
import { securePath } from "@outfitter/file-ops";

const result = securePath("notes/meeting.md", "/data");
if (result.isOk()) {
  console.log(result.value); // "/data/notes/meeting.md"
}

// Rejects traversal
const bad = securePath("../etc/passwd", "/data");
// → Result.err(ValidationError: "Path contains traversal sequence")

// Rejects null bytes
const bad2 = securePath("file\x00.txt", "/data");
// → Result.err(ValidationError: "Path contains null bytes")

// Rejects absolute paths
const bad3 = securePath("/etc/passwd", "/data");
// → Result.err(ValidationError: "Absolute paths are not allowed")
```

**Signature:** `securePath(path: string, basePath: string) → Result<string, ValidationError>`

### isPathSafe

Boolean convenience wrapper around `securePath`:

```typescript
import { isPathSafe } from "@outfitter/file-ops";

if (isPathSafe(userInput, "/data")) {
  // Safe to use
}
```

**Signature:** `isPathSafe(path: string, basePath: string) → boolean`

### resolveSafePath

Joins multiple path segments with per-segment validation:

```typescript
import { resolveSafePath } from "@outfitter/file-ops";

const result = resolveSafePath("/data", "users", "profile.json");
if (result.isOk()) {
  console.log(result.value); // "/data/users/profile.json"
}

// Each segment validated individually
const bad = resolveSafePath("/data", "users", "../secrets");
// → Result.err(ValidationError: "Path segment contains traversal sequence")
```

**Signature:** `resolveSafePath(basePath: string, ...segments: string[]) → Result<string, ValidationError>`

## Glob Patterns

File matching powered by `Bun.Glob`. Returns absolute paths.

### Async Glob

```typescript
import { glob } from "@outfitter/file-ops";

const result = await glob("**/*.ts", {
  cwd: "/workspace/src",
  ignore: ["**/*.test.ts", "!**/*.integration.test.ts"],
  dot: false,
});

if (result.isOk()) {
  for (const file of result.value) {
    console.log(file); // absolute paths
  }
}
```

**Signature:** `glob(pattern: string, options?: GlobOptions) → Promise<Result<string[], InternalError>>`

### Sync Glob

For initialization code only — blocks the event loop:

```typescript
import { globSync } from "@outfitter/file-ops";

const result = globSync("*.json", { cwd: "/config" });
```

**Signature:** `globSync(pattern: string, options?: GlobOptions) → Result<string[], InternalError>`

### GlobOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cwd` | `string` | `process.cwd()` | Base directory for matching |
| `ignore` | `string[]` | — | Exclude patterns (prefix `!` to re-include) |
| `followSymlinks` | `boolean` | `false` | Follow symbolic links |
| `dot` | `boolean` | `false` | Include dotfiles |

## File Locking

Advisory file locking via `.lock` files. All processes must cooperate — the filesystem does **not** enforce locks.

### Exclusive Lock (Recommended: withLock)

```typescript
import { withLock } from "@outfitter/file-ops";

const result = await withLock("/data/state.json", async () => {
  const data = await Bun.file("/data/state.json").json();
  data.counter += 1;
  await Bun.write("/data/state.json", JSON.stringify(data));
  return data;
});

if (result.isErr()) {
  // ConflictError: file already locked
  // InternalError: callback or release failed
}
```

**Signature:** `withLock<T>(path: string, callback: () => Promise<T>) → Promise<Result<T, ConflictError | InternalError>>`

### Manual Exclusive Lock

For cases where you need lock lifetime control:

```typescript
import { acquireLock, releaseLock, isLocked } from "@outfitter/file-ops";

// Check if locked
if (await isLocked("/data/state.json")) {
  console.log("File is locked");
}

// Acquire with timeout
const lockResult = await acquireLock("/data/state.json", {
  timeout: 5000,      // Wait up to 5s
  retryInterval: 100, // Poll every 100ms
});

if (lockResult.isOk()) {
  const lock = lockResult.value;
  try {
    // Do work...
  } finally {
    await releaseLock(lock);
  }
}
```

### Shared (Reader) Locks

Multiple readers can hold shared locks simultaneously. Shared locks block exclusive locks and vice versa.

```typescript
import { withSharedLock, withLock } from "@outfitter/file-ops";

// Multiple readers can run concurrently
const readResult = await withSharedLock("/data/db.json", async () => {
  return await Bun.file("/data/db.json").json();
});

// Writers need exclusive lock (blocks and is blocked by shared locks)
const writeResult = await withLock("/data/db.json", async () => {
  const data = await Bun.file("/data/db.json").json();
  data.updated = Date.now();
  await Bun.write("/data/db.json", JSON.stringify(data));
  return data;
});
```

Manual shared lock API:

```typescript
import { acquireSharedLock, releaseSharedLock } from "@outfitter/file-ops";

const lockResult = await acquireSharedLock("/data/db.json", { timeout: 3000 });
if (lockResult.isOk()) {
  const lock = lockResult.value;
  lock.lockType;  // "shared"
  lock.readerId;  // unique reader ID (UUIDv7)
  // ... read data ...
  await releaseSharedLock(lock);
}
```

### Lock Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `0` (fail immediately) | Max wait time in ms |
| `retryInterval` | `number` | `50` | Delay between retries in ms |

### Lock File Conventions

- Lock files are created at `${path}.lock` automatically
- Place locks alongside the protected resource
- Use consistent lock paths across all accessors

## Atomic Writes

Write files atomically using temp-file-then-rename. The file either has old content or new content — never a partial state.

### atomicWrite

```typescript
import { atomicWrite } from "@outfitter/file-ops";

const result = await atomicWrite("/data/config.json", JSON.stringify(data, null, 2));

// With options
const result2 = await atomicWrite("/data/config.json", content, {
  createParentDirs: true,   // default: true
  preservePermissions: true, // copy perms from existing file
  mode: 0o644,              // fallback file mode
});
```

**Signature:** `atomicWrite(path: string, content: string, options?: AtomicWriteOptions) → Promise<Result<void, InternalError>>`

### atomicWriteJson

Shorthand for serializing + atomic write:

```typescript
import { atomicWriteJson } from "@outfitter/file-ops";

const result = await atomicWriteJson("/data/state.json", { counter: 42 });
// ValidationError if data isn't serializable
// InternalError if write fails
```

**Signature:** `atomicWriteJson<T>(path: string, data: T, options?: AtomicWriteOptions) → Promise<Result<void, InternalError | ValidationError>>`

### AtomicWriteOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `createParentDirs` | `boolean` | `true` | Create parent dirs recursively |
| `preservePermissions` | `boolean` | `false` | Copy permissions from existing file |
| `mode` | `number` | `0o644` | File mode for new files |

## Best Practices

1. **Always use `securePath` or `resolveSafePath`** when handling user-provided paths
2. **Prefer `withLock`** over manual acquire/release — it handles cleanup on errors
3. **Use shared locks** for read operations to improve concurrency
4. **Use `atomicWrite`** for critical data to prevent corruption
5. **Use `findWorkspaceRoot`** instead of hardcoding paths
6. **Use XDG paths** from `@outfitter/config` for state/cache files

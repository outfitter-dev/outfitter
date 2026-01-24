# @outfitter/file-ops

Workspace detection, secure path handling, glob patterns, file locking, and atomic write utilities for Outfitter projects.

## Installation

```bash
bun add @outfitter/file-ops
```

## Quick Start

```typescript
import {
  findWorkspaceRoot,
  securePath,
  glob,
  withLock,
  atomicWrite
} from "@outfitter/file-ops";

// Find workspace root by marker files (.git, package.json)
const rootResult = await findWorkspaceRoot(process.cwd());
if (rootResult.isOk()) {
  const root = rootResult.value;

  // Secure path resolution (prevents traversal attacks)
  const pathResult = securePath("src/config.json", root);
  if (pathResult.isOk()) {
    console.log("Safe path:", pathResult.value);
  }
}

// Find files with glob patterns
const files = await glob("**/*.ts", {
  cwd: "/project",
  ignore: ["node_modules/**", "**/*.test.ts"]
});

// Atomic write with file locking
await withLock("/path/to/file.json", async () => {
  await atomicWrite("/path/to/file.json", JSON.stringify(data));
});
```

## API Reference

### Workspace Detection

#### `findWorkspaceRoot(startPath, options?)`

Finds the workspace root by searching for marker files/directories.

```typescript
const result = await findWorkspaceRoot("/project/src/lib");
if (result.isOk()) {
  console.log("Workspace:", result.value); // "/project"
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `markers` | `string[]` | `[".git", "package.json"]` | Marker files/directories to search for |
| `stopAt` | `string` | filesystem root | Stop searching at this directory |

```typescript
// Custom markers for Rust or Python projects
const result = await findWorkspaceRoot(startPath, {
  markers: ["Cargo.toml", "pyproject.toml"],
  stopAt: "/home/user"
});
```

#### `getRelativePath(absolutePath)`

Returns the path relative to the workspace root.

```typescript
const result = await getRelativePath("/project/src/lib/utils.ts");
if (result.isOk()) {
  console.log(result.value); // "src/lib/utils.ts"
}
```

#### `isInsideWorkspace(path, workspaceRoot)`

Checks if a path is inside a workspace directory.

```typescript
const inside = await isInsideWorkspace("/project/src/file.ts", "/project");
console.log(inside); // true

const outside = await isInsideWorkspace("/etc/passwd", "/project");
console.log(outside); // false
```

### Path Security

**IMPORTANT**: These functions protect against path traversal attacks. Always use them when handling user-provided paths.

#### Security Model

| Attack Vector | Protection |
|--------------|------------|
| Path traversal (`../`) | Blocked by all security functions |
| Null bytes (`\x00`) | Rejected immediately |
| Absolute paths | Blocked when relative expected |
| Escape from base directory | Defense-in-depth verification |

#### `securePath(path, basePath)`

Validates and secures a user-provided path, preventing path traversal attacks.

```typescript
// SAFE: Validates path stays within basePath
const result = securePath("data/file.json", "/app/workspace");
if (result.isOk()) {
  // Safe to use: /app/workspace/data/file.json
  console.log(result.value);
}

// These all return ValidationError:
securePath("../etc/passwd", base);      // Traversal sequence
securePath("/etc/passwd", base);        // Absolute path
securePath("file\x00.txt", base);       // Null byte
```

**UNSAFE pattern - never do this:**

```typescript
// DON'T: User input directly in path.join
const bad = path.join("/base", userInput); // VULNERABLE!

// DO: Always validate with securePath first
const result = securePath(userInput, "/base");
if (result.isOk()) {
  // Now safe to use
}
```

#### `isPathSafe(path, basePath)`

Quick boolean check for path safety.

```typescript
if (isPathSafe(userInput, basePath)) {
  // Safe to proceed
}
```

#### `resolveSafePath(basePath, ...segments)`

Safely joins multiple path segments.

```typescript
const result = resolveSafePath("/app", "data", "users", "profile.json");
if (result.isOk()) {
  console.log(result.value); // "/app/data/users/profile.json"
}

// Rejects dangerous segments
resolveSafePath("/app", "..", "etc");     // Error: traversal
resolveSafePath("/app", "/etc/passwd");   // Error: absolute segment
```

### Glob Patterns

#### `glob(pattern, options?)`

Finds files matching a glob pattern. Uses `Bun.Glob` internally.

```typescript
// Find all TypeScript files
const result = await glob("**/*.ts", { cwd: "/project" });

// Exclude test files and node_modules
const result = await glob("**/*.ts", {
  cwd: "/project",
  ignore: ["**/*.test.ts", "**/node_modules/**"]
});

// Include dot files
const result = await glob("**/.*", { cwd: "/project", dot: true });
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cwd` | `string` | `process.cwd()` | Base directory for matching |
| `ignore` | `string[]` | `[]` | Patterns to exclude |
| `followSymlinks` | `boolean` | `false` | Follow symbolic links |
| `dot` | `boolean` | `false` | Include dot files |

**Pattern Syntax:**

| Pattern | Matches |
|---------|---------|
| `*` | Any characters except `/` |
| `**` | Any characters including `/` (recursive) |
| `{a,b}` | Alternation (matches `a` or `b`) |
| `[abc]` | Character class (matches `a`, `b`, or `c`) |
| `!pattern` | Negation (in ignore array) |

```typescript
// Negation patterns in ignore array
const result = await glob("src/**/*.ts", {
  cwd: "/project",
  ignore: ["**/*.ts", "!**/index.ts"]  // Ignore all except index.ts
});
```

#### `globSync(pattern, options?)`

Synchronous version of `glob`.

```typescript
const result = globSync("src/*.ts", { cwd: "/project" });
```

### File Locking

Advisory file locking for cross-process coordination. Uses `.lock` files to indicate locks.

**Note**: This is advisory locking. All processes must cooperate by using these APIs.

#### `withLock(path, callback)`

Recommended approach. Executes a callback while holding an exclusive lock, with automatic release.

```typescript
const result = await withLock("/data/config.json", async () => {
  const config = JSON.parse(await Bun.file("/data/config.json").text());
  config.counter++;
  await atomicWrite("/data/config.json", JSON.stringify(config));
  return config.counter;
});

if (result.isOk()) {
  console.log("New counter:", result.value);
} else if (result.error._tag === "ConflictError") {
  console.log("File is locked by another process");
}
```

#### `acquireLock(path)` / `releaseLock(lock)`

Manual lock management. Use `withLock` when possible.

```typescript
const lockResult = await acquireLock("/data/file.db");
if (lockResult.isOk()) {
  const lock = lockResult.value;
  try {
    // ... do work ...
  } finally {
    await releaseLock(lock);
  }
}
```

#### `isLocked(path)`

Checks if a file is currently locked.

```typescript
if (await isLocked("/data/file.db")) {
  console.log("File is in use");
}
```

#### FileLock Interface

```typescript
interface FileLock {
  path: string;      // Path to the locked file
  lockPath: string;  // Path to the .lock file
  pid: number;       // Process ID holding the lock
  timestamp: number; // When lock was acquired
}
```

### Atomic Writes

Write files atomically using temp-file-then-rename strategy. This prevents partial writes and corruption.

#### `atomicWrite(path, content, options?)`

Writes content to a file atomically.

```typescript
const result = await atomicWrite("/data/config.json", JSON.stringify(data));
if (result.isErr()) {
  console.error("Write failed:", result.error.message);
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `createParentDirs` | `boolean` | `true` | Create parent directories if needed |
| `preservePermissions` | `boolean` | `false` | Keep permissions from existing file |
| `mode` | `number` | `0o644` | File mode for new files |

```typescript
// Preserve executable permissions
await atomicWrite("/scripts/run.sh", newContent, {
  preservePermissions: true
});

// Create nested directories automatically
await atomicWrite("/data/deep/nested/file.json", content, {
  createParentDirs: true
});
```

#### `atomicWriteJson(path, data, options?)`

Serializes and writes JSON data atomically.

```typescript
const result = await atomicWriteJson("/data/config.json", {
  name: "app",
  version: "1.0.0",
  settings: { debug: false }
});
```

## Error Handling

All functions return `Result` types from `@outfitter/contracts`. Use `.isOk()` and `.isErr()` to handle outcomes.

```typescript
import type { Result } from "@outfitter/contracts";

const result = await findWorkspaceRoot("/path");

if (result.isOk()) {
  const workspace = result.value;
} else {
  // result.error has _tag, message, and error-specific fields
  console.error(result.error._tag, result.error.message);
}
```

**Error Types:**

| Error | Functions | When |
|-------|-----------|------|
| `NotFoundError` | `findWorkspaceRoot`, `getRelativePath` | No workspace marker found |
| `ValidationError` | `securePath`, `isPathSafe`, `resolveSafePath`, `atomicWriteJson` | Invalid path or data |
| `ConflictError` | `acquireLock`, `withLock` | File already locked |
| `InternalError` | `glob`, `releaseLock`, `withLock`, `atomicWrite` | Filesystem or system error |

## Dependencies

- `@outfitter/contracts` - Result types and error classes
- `@outfitter/types` - Type utilities

## License

MIT

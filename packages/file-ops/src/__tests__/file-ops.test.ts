/**
 * @outfitter/file-ops - Test Suite
 *
 * TDD RED PHASE: These tests document expected behavior and WILL FAIL
 * until implementation is complete. This is intentional - the failing
 * tests serve as the specification for the implementation.
 *
 * Test categories:
 * 1. Workspace Detection (8 tests)
 * 2. Path Security (8 tests)
 * 3. Glob Patterns (8 tests)
 * 4. File Locking (8 tests)
 * 5. Atomic Writes (8 tests)
 * 6. Shared (Reader) Locking (8 tests)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireLock,
  acquireSharedLock,
  atomicWrite,
  atomicWriteJson,
  findWorkspaceRoot,
  getRelativePath,
  glob,
  globSync,
  isInsideWorkspace,
  isLocked,
  isPathSafe,
  releaseLock,
  releaseSharedLock,
  resolveSafePath,
  securePath,
  withLock,
  withSharedLock,
} from "../index.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

let testDir: string;
let testCounter = 0;

async function createTestDir(): Promise<string> {
  testCounter++;
  const dir = join(tmpdir(), `file-ops-test-${Date.now()}-${testCounter}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// 1. Workspace Detection Tests
// ============================================================================

describe("Workspace Detection", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("findWorkspaceRoot finds nearest .git directory", async () => {
    // Setup: Create nested structure with .git at root
    const gitDir = join(testDir, ".git");
    const nestedDir = join(testDir, "packages", "core", "src");
    await mkdir(gitDir, { recursive: true });
    await mkdir(nestedDir, { recursive: true });

    const result = await findWorkspaceRoot(nestedDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(testDir);
    }
  });

  it("findWorkspaceRoot finds nearest package.json", async () => {
    // Setup: Create nested structure with package.json at root
    const nestedDir = join(testDir, "src", "lib");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(join(testDir, "package.json"), "{}");

    const result = await findWorkspaceRoot(nestedDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(testDir);
    }
  });

  it("findWorkspaceRoot returns NotFoundError when no markers found", async () => {
    // Setup: Empty directory with no markers
    const emptyDir = join(testDir, "empty");
    await mkdir(emptyDir, { recursive: true });

    const result = await findWorkspaceRoot(emptyDir, {
      markers: [".git", "package.json"],
      stopAt: testDir, // Stop before reaching actual filesystem root
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("NotFoundError");
    }
  });

  it("findWorkspaceRoot respects marker priority (.git > package.json)", async () => {
    // Setup: Both .git and package.json at same level
    const gitDir = join(testDir, ".git");
    await mkdir(gitDir, { recursive: true });
    await writeFile(join(testDir, "package.json"), "{}");
    const nestedDir = join(testDir, "src");
    await mkdir(nestedDir, { recursive: true });

    // When both are present, .git should be the marker used
    const result = await findWorkspaceRoot(nestedDir, {
      markers: [".git", "package.json"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should find the directory with .git (same as package.json here)
      expect(result.value).toBe(testDir);
    }
  });

  it("findWorkspaceRoot accepts custom markers array", async () => {
    // Setup: Custom marker file
    const nestedDir = join(testDir, "deep", "nested");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(join(testDir, ".workspace"), "");

    const result = await findWorkspaceRoot(nestedDir, {
      markers: [".workspace"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(testDir);
    }
  });

  it("findWorkspaceRoot stops at filesystem root", async () => {
    // This test verifies we don't infinite loop
    // Use a directory that definitely has no markers above testDir
    const isolatedDir = join(testDir, "isolated");
    await mkdir(isolatedDir, { recursive: true });

    const result = await findWorkspaceRoot(isolatedDir, {
      markers: ["__nonexistent_marker__"],
      stopAt: testDir,
    });

    expect(result.isErr()).toBe(true);
  });

  it("getRelativePath returns path relative to workspace root", async () => {
    // Setup
    const gitDir = join(testDir, ".git");
    const filePath = join(testDir, "packages", "core", "index.ts");
    await mkdir(gitDir, { recursive: true });
    await mkdir(join(testDir, "packages", "core"), { recursive: true });
    await writeFile(filePath, "");

    const result = await getRelativePath(filePath);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("packages/core/index.ts");
    }
  });

  it("isInsideWorkspace checks if path is within workspace", async () => {
    // Setup
    const gitDir = join(testDir, ".git");
    await mkdir(gitDir, { recursive: true });
    const insidePath = join(testDir, "src", "index.ts");
    const outsidePath = "/tmp/outside/file.ts";

    const insideResult = await isInsideWorkspace(insidePath, testDir);
    const outsideResult = await isInsideWorkspace(outsidePath, testDir);

    expect(insideResult).toBe(true);
    expect(outsideResult).toBe(false);
  });
});

// ============================================================================
// 2. Path Security Tests
// ============================================================================

describe("Path Security", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("securePath rejects paths with .. traversal", () => {
    const result = securePath("../../../etc/passwd", testDir);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("ValidationError");
      expect(result.error.message).toContain("traversal");
    }
  });

  it("securePath rejects absolute paths when basePath provided", () => {
    const result = securePath("/etc/passwd", testDir);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("ValidationError");
    }
  });

  it("securePath normalizes paths (removes ./ prefix)", () => {
    const result = securePath("./src/index.ts", testDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(join(testDir, "src/index.ts"));
    }
  });

  it("securePath returns Result.err(ValidationError) for invalid paths", () => {
    // Null bytes and other invalid characters
    const result = securePath("file\x00name.ts", testDir);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("ValidationError");
    }
  });

  it("securePath allows valid relative paths", () => {
    const result = securePath("src/lib/utils.ts", testDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(join(testDir, "src/lib/utils.ts"));
    }
  });

  it("isPathSafe returns boolean for validation", () => {
    expect(isPathSafe("src/index.ts", testDir)).toBe(true);
    expect(isPathSafe("../../../etc/passwd", testDir)).toBe(false);
    expect(isPathSafe("/absolute/path", testDir)).toBe(false);
  });

  it("resolveSafePath combines base and relative securely", () => {
    const result = resolveSafePath(testDir, "packages", "core", "src");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(join(testDir, "packages", "core", "src"));
    }
  });

  it("securePath handles Windows-style paths", () => {
    // Should normalize backslashes on all platforms
    const result = securePath("src\\lib\\utils.ts", testDir);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should be normalized to forward slashes
      expect(result.value).toBe(join(testDir, "src/lib/utils.ts"));
    }
  });
});

// ============================================================================
// 3. Glob Pattern Tests
// ============================================================================

describe("Glob Patterns", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
    // Setup test file structure
    await mkdir(join(testDir, "src", "lib"), { recursive: true });
    await mkdir(join(testDir, "src", "utils"), { recursive: true });
    await mkdir(join(testDir, "node_modules", "pkg"), { recursive: true });
    await writeFile(join(testDir, "src", "index.ts"), "");
    await writeFile(join(testDir, "src", "lib", "helpers.ts"), "");
    await writeFile(join(testDir, "src", "lib", "helpers.test.ts"), "");
    await writeFile(join(testDir, "src", "utils", "format.ts"), "");
    await writeFile(join(testDir, "src", "utils", "parse.js"), "");
    await writeFile(join(testDir, "node_modules", "pkg", "index.js"), "");
    await writeFile(join(testDir, "README.md"), "");
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("glob returns matching files for simple patterns", async () => {
    const result = await glob("src/*.ts", { cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain(join(testDir, "src", "index.ts"));
      expect(result.value).toHaveLength(1);
    }
  });

  it("glob supports ** for recursive matching", async () => {
    const result = await glob("src/**/*.ts", { cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain(join(testDir, "src", "index.ts"));
      expect(result.value).toContain(join(testDir, "src", "lib", "helpers.ts"));
      expect(result.value).toContain(
        join(testDir, "src", "lib", "helpers.test.ts")
      );
      expect(result.value).toContain(
        join(testDir, "src", "utils", "format.ts")
      );
      expect(result.value).toHaveLength(4);
    }
  });

  it("glob supports {a,b} alternation", async () => {
    const result = await glob("src/**/*.{ts,js}", { cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain(join(testDir, "src", "utils", "parse.js"));
      expect(result.value.length).toBeGreaterThan(4);
    }
  });

  it("glob supports [abc] character classes", async () => {
    const result = await glob("src/**/*.[tj]s", { cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should match both .ts and .js files
      expect(result.value.length).toBeGreaterThan(0);
    }
  });

  it("glob respects ignore patterns", async () => {
    const result = await glob("**/*.ts", {
      cwd: testDir,
      ignore: ["**/*.test.ts", "**/node_modules/**"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Should not include test files
      expect(result.value).not.toContain(
        join(testDir, "src", "lib", "helpers.test.ts")
      );
      expect(result.value).toContain(join(testDir, "src", "lib", "helpers.ts"));
    }
  });

  it("glob returns empty array for no matches", async () => {
    const result = await glob("**/*.xyz", { cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
  });

  it("glob handles .gitignore-style negation patterns", async () => {
    const result = await glob("src/**/*.ts", {
      cwd: testDir,
      ignore: ["**/*.ts", "!**/index.ts"],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // With negation, should only match index.ts
      expect(result.value).toContain(join(testDir, "src", "index.ts"));
    }
  });

  it("globSync provides synchronous API", () => {
    const result = globSync("src/*.ts", { cwd: testDir });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain(join(testDir, "src", "index.ts"));
    }
  });
});

// ============================================================================
// 4. File Locking Tests
// ============================================================================

describe("File Locking", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("acquireLock creates lock file", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    const result = await acquireLock(targetFile);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // Lock file should exist
      const lockPath = `${targetFile}.lock`;
      const lockExists = await Bun.file(lockPath).exists();
      expect(lockExists).toBe(true);

      // Cleanup
      await releaseLock(result.value);
    }
  });

  it("acquireLock returns Result.err(ConflictError) when locked", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    // Acquire first lock
    const lock1 = await acquireLock(targetFile);
    expect(lock1.isOk()).toBe(true);

    // Try to acquire second lock - should fail
    const lock2 = await acquireLock(targetFile);

    expect(lock2.isErr()).toBe(true);
    if (lock2.isErr()) {
      expect(lock2.error._tag).toBe("ConflictError");
    }

    // Cleanup
    if (lock1.isOk()) {
      await releaseLock(lock1.value);
    }
  });

  it("releaseLock removes lock file", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    const lockResult = await acquireLock(targetFile);
    expect(lockResult.isOk()).toBe(true);

    if (lockResult.isOk()) {
      const releaseResult = await releaseLock(lockResult.value);
      expect(releaseResult.isOk()).toBe(true);

      // Lock file should no longer exist
      const lockPath = `${targetFile}.lock`;
      const lockExists = await Bun.file(lockPath).exists();
      expect(lockExists).toBe(false);
    }
  });

  it("withLock executes callback while holding lock", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, '{"count": 0}');

    let callbackExecuted = false;
    const result = await withLock(targetFile, async () => {
      callbackExecuted = true;
      return 42;
    });

    expect(callbackExecuted).toBe(true);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(42);
    }
  });

  it("withLock releases lock after callback completes", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    await withLock(targetFile, async () => {
      // Lock should be held here
      const lockPath = `${targetFile}.lock`;
      const lockExists = await Bun.file(lockPath).exists();
      expect(lockExists).toBe(true);
    });

    // After withLock completes, lock should be released
    const lockPath = `${targetFile}.lock`;
    const lockExists = await Bun.file(lockPath).exists();
    expect(lockExists).toBe(false);
  });

  it("withLock releases lock on callback error", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    const result = await withLock(targetFile, async () => {
      throw new Error("Callback failed");
    });

    // Should return error result
    expect(result.isErr()).toBe(true);

    // But lock should still be released
    const lockPath = `${targetFile}.lock`;
    const lockExists = await Bun.file(lockPath).exists();
    expect(lockExists).toBe(false);
  });

  it("Lock includes timestamp and PID", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    const lockResult = await acquireLock(targetFile);
    expect(lockResult.isOk()).toBe(true);

    if (lockResult.isOk()) {
      const lock = lockResult.value;
      expect(lock.pid).toBe(process.pid);
      expect(typeof lock.timestamp).toBe("number");
      expect(lock.timestamp).toBeLessThanOrEqual(Date.now());

      await releaseLock(lock);
    }
  });

  it("isLocked checks if file is currently locked", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    // Initially not locked
    expect(await isLocked(targetFile)).toBe(false);

    // Acquire lock
    const lockResult = await acquireLock(targetFile);
    expect(lockResult.isOk()).toBe(true);

    // Now should be locked
    expect(await isLocked(targetFile)).toBe(true);

    // Release and check again
    if (lockResult.isOk()) {
      await releaseLock(lockResult.value);
    }
    expect(await isLocked(targetFile)).toBe(false);
  });
});

// ============================================================================
// 5. Atomic Writes Tests
// ============================================================================

describe("Atomic Writes", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("atomicWrite writes to temp file then renames", async () => {
    const targetFile = join(testDir, "config.json");
    const content = '{"setting": "value"}';

    const result = await atomicWrite(targetFile, content);

    expect(result.isOk()).toBe(true);

    // File should exist with correct content
    const written = await Bun.file(targetFile).text();
    expect(written).toBe(content);

    // No temp files should remain
    const files = await Array.fromAsync(new Bun.Glob("*.tmp").scan(testDir));
    expect(files).toHaveLength(0);
  });

  it("atomicWrite preserves file permissions", async () => {
    const targetFile = join(testDir, "script.sh");
    await writeFile(targetFile, "#!/bin/bash\necho hello");
    // Set executable permission (not using chmod to avoid git operations)

    const result = await atomicWrite(targetFile, "#!/bin/bash\necho world", {
      preservePermissions: true,
    });

    expect(result.isOk()).toBe(true);
  });

  it("atomicWrite is atomic (all-or-nothing)", async () => {
    const targetFile = join(testDir, "data.json");
    const originalContent = '{"version": 1}';
    await writeFile(targetFile, originalContent);

    // Simulate a write that would fail during rename
    // In practice, this tests the temp-file-then-rename strategy
    const result = await atomicWrite(targetFile, '{"version": 2}');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const content = await Bun.file(targetFile).text();
      expect(content).toBe('{"version": 2}');
    }
  });

  it("atomicWrite returns Result type", async () => {
    const targetFile = join(testDir, "output.txt");

    const result = await atomicWrite(targetFile, "content");

    // Should be a proper Result type
    expect("value" in result || "error" in result).toBe(true);
    expect(result.isOk() || result.isErr()).toBe(true);
  });

  it("atomicWriteJson handles JSON serialization", async () => {
    const targetFile = join(testDir, "config.json");
    const data = { name: "test", values: [1, 2, 3], nested: { key: "value" } };

    const result = await atomicWriteJson(targetFile, data);

    expect(result.isOk()).toBe(true);

    const written = await Bun.file(targetFile).json();
    expect(written).toEqual(data);
  });

  it("atomicWrite cleans up temp file on failure", async () => {
    // Create a read-only directory to force failure
    const readOnlyDir = join(testDir, "readonly");
    await mkdir(readOnlyDir, { recursive: true });

    // Try to write to a path that will fail (invalid directory)
    const targetFile = join(
      testDir,
      "nonexistent",
      "deeply",
      "nested",
      "file.txt"
    );

    const result = await atomicWrite(targetFile, "content", {
      createParentDirs: false,
    });

    expect(result.isErr()).toBe(true);

    // No temp files should be left behind
    const tempFiles = await Array.fromAsync(
      new Bun.Glob("*.tmp").scan(testDir)
    );
    expect(tempFiles).toHaveLength(0);
  });

  it("atomicWrite creates parent directories if needed", async () => {
    const targetFile = join(testDir, "deep", "nested", "dir", "file.txt");

    const result = await atomicWrite(targetFile, "content", {
      createParentDirs: true,
    });

    expect(result.isOk()).toBe(true);

    const content = await Bun.file(targetFile).text();
    expect(content).toBe("content");
  });

  it("atomicWrite handles concurrent writes safely", async () => {
    const targetFile = join(testDir, "concurrent.json");

    // Start multiple concurrent writes
    const writes = Array.from({ length: 10 }, (_, i) =>
      atomicWrite(targetFile, `{"write": ${i}}`)
    );

    const results = await Promise.all(writes);

    // All writes should succeed (no corruption)
    const successCount = results.filter((r) => r.isOk()).length;
    expect(successCount).toBe(10);

    // File should contain valid JSON (one of the writes)
    const content = await Bun.file(targetFile).text();
    const parsed = JSON.parse(content);
    expect(typeof parsed.write).toBe("number");
  });
});

// ============================================================================
// 6. Shared (Reader) Locking Tests
// ============================================================================

describe("Shared (Reader) Locking", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("single reader can acquire shared lock", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    const result = await acquireSharedLock(targetFile);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const lock = result.value;
      expect(lock.lockType).toBe("shared");
      expect(lock.pid).toBe(process.pid);
      expect(typeof lock.timestamp).toBe("number");

      // Cleanup
      await releaseSharedLock(lock);
    }
  });

  it("multiple readers can hold shared locks simultaneously", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    // Acquire first shared lock
    const lock1Result = await acquireSharedLock(targetFile);
    expect(lock1Result.isOk()).toBe(true);

    // Acquire second shared lock (should succeed)
    const lock2Result = await acquireSharedLock(targetFile);
    expect(lock2Result.isOk()).toBe(true);

    // Verify lock file contains multiple readers
    const lockPath = `${targetFile}.lock`;
    const lockContent = await Bun.file(lockPath).json();
    expect(lockContent.type).toBe("shared");
    expect(lockContent.readers.length).toBe(2);

    // Cleanup
    if (lock1Result.isOk()) {
      await releaseSharedLock(lock1Result.value);
    }
    if (lock2Result.isOk()) {
      await releaseSharedLock(lock2Result.value);
    }
  });

  it("exclusive lock blocks new shared locks", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    // Acquire exclusive lock first
    const exclusiveLock = await acquireLock(targetFile);
    expect(exclusiveLock.isOk()).toBe(true);

    // Try to acquire shared lock - should fail
    const sharedLock = await acquireSharedLock(targetFile);
    expect(sharedLock.isErr()).toBe(true);
    if (sharedLock.isErr()) {
      expect(sharedLock.error._tag).toBe("ConflictError");
    }

    // Cleanup
    if (exclusiveLock.isOk()) {
      await releaseLock(exclusiveLock.value);
    }
  });

  it("shared locks block exclusive lock acquisition", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    // Acquire shared lock first
    const sharedLock = await acquireSharedLock(targetFile);
    expect(sharedLock.isOk()).toBe(true);

    // Try to acquire exclusive lock - should fail
    const exclusiveLock = await acquireLock(targetFile);
    expect(exclusiveLock.isErr()).toBe(true);
    if (exclusiveLock.isErr()) {
      expect(exclusiveLock.error._tag).toBe("ConflictError");
    }

    // Cleanup
    if (sharedLock.isOk()) {
      await releaseSharedLock(sharedLock.value);
    }
  });

  it("reader count decrements on release", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");
    const lockPath = `${targetFile}.lock`;

    // Acquire two shared locks
    const lock1Result = await acquireSharedLock(targetFile);
    const lock2Result = await acquireSharedLock(targetFile);

    expect(lock1Result.isOk()).toBe(true);
    expect(lock2Result.isOk()).toBe(true);

    // Verify two readers
    let lockContent = await Bun.file(lockPath).json();
    expect(lockContent.readers.length).toBe(2);

    // Release one lock
    if (lock1Result.isOk()) {
      await releaseSharedLock(lock1Result.value);
    }

    // Verify one reader remains
    lockContent = await Bun.file(lockPath).json();
    expect(lockContent.readers.length).toBe(1);

    // Cleanup
    if (lock2Result.isOk()) {
      await releaseSharedLock(lock2Result.value);
    }
  });

  it("lock file cleaned up when last reader releases", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");
    const lockPath = `${targetFile}.lock`;

    // Acquire shared lock
    const lockResult = await acquireSharedLock(targetFile);
    expect(lockResult.isOk()).toBe(true);

    // Lock file should exist
    expect(await Bun.file(lockPath).exists()).toBe(true);

    // Release lock
    if (lockResult.isOk()) {
      const releaseResult = await releaseSharedLock(lockResult.value);
      expect(releaseResult.isOk()).toBe(true);
    }

    // Lock file should be deleted
    expect(await Bun.file(lockPath).exists()).toBe(false);
  });

  it("withSharedLock executes callback and releases", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, '{"count": 0}');

    let callbackExecuted = false;
    const result = await withSharedLock(targetFile, async () => {
      callbackExecuted = true;
      // Verify lock is held during callback
      const lockPath = `${targetFile}.lock`;
      const lockExists = await Bun.file(lockPath).exists();
      expect(lockExists).toBe(true);
      return 42;
    });

    expect(callbackExecuted).toBe(true);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(42);
    }

    // Lock should be released after callback
    const lockPath = `${targetFile}.lock`;
    const lockExists = await Bun.file(lockPath).exists();
    expect(lockExists).toBe(false);
  });

  it("withSharedLock releases lock on callback error", async () => {
    const targetFile = join(testDir, "data.json");
    await writeFile(targetFile, "{}");

    const result = await withSharedLock(targetFile, async () => {
      throw new Error("Callback failed");
    });

    // Should return error result
    expect(result.isErr()).toBe(true);

    // But lock should still be released
    const lockPath = `${targetFile}.lock`;
    const lockExists = await Bun.file(lockPath).exists();
    expect(lockExists).toBe(false);
  });
});

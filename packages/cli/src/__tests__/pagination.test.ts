/**
 * Tests for CLI pagination utilities.
 *
 * This is the RED phase of TDD - all tests should fail with "not implemented".
 *
 * XDG State Directory Pattern:
 * Path: $XDG_STATE_HOME/{toolName}/cursors/{command}[/{context}]/cursor.json
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearCursor, loadCursor, saveCursor } from "../pagination.js";
import type { PaginationState } from "../types.js";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a unique temporary directory for test isolation.
 */
async function createTempDir(): Promise<string> {
  const tempBase = join(tmpdir(), "outfitter-cli-test");
  const uniqueDir = join(
    tempBase,
    `pagination-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(uniqueDir, { recursive: true });
  return uniqueDir;
}

/**
 * Creates a cursor.json file at the expected XDG path.
 */
async function createCursorFile(
  stateHome: string,
  toolName: string,
  command: string,
  state: PaginationState,
  context?: string
): Promise<string> {
  const cursorDir = context
    ? join(stateHome, toolName, "cursors", command, context)
    : join(stateHome, toolName, "cursors", command);
  await mkdir(cursorDir, { recursive: true });
  const cursorPath = join(cursorDir, "cursor.json");
  await writeFile(cursorPath, JSON.stringify(state), "utf-8");
  return cursorPath;
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let originalEnv: NodeJS.ProcessEnv;
let tempDir: string;

beforeEach(async () => {
  // Save original environment
  originalEnv = { ...process.env };

  // Create isolated temp directory for each test
  tempDir = await createTempDir();

  // Set XDG_STATE_HOME to our temp directory
  process.env.XDG_STATE_HOME = tempDir;
});

afterEach(async () => {
  // Restore original environment
  process.env = originalEnv;

  // Clean up temp directory
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// =============================================================================
// loadCursor() Tests
// =============================================================================

describe("loadCursor()", () => {
  test("returns undefined when no cursor exists", () => {
    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result).toBeUndefined();
  });

  test("returns PaginationState when cursor exists", async () => {
    const expectedState: PaginationState = {
      cursor: "abc123",
      command: "list",
      timestamp: Date.now(),
      hasMore: true,
    };

    await createCursorFile(tempDir, "waymark", "list", expectedState);

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result).toBeDefined();
    expect(result?.cursor).toBe("abc123");
    expect(result?.hasMore).toBe(true);
  });

  test("scopes by command name", async () => {
    const listState: PaginationState = {
      cursor: "list-cursor",
      command: "list",
      timestamp: Date.now(),
      hasMore: true,
    };

    const searchState: PaginationState = {
      cursor: "search-cursor",
      command: "search",
      timestamp: Date.now(),
      hasMore: false,
    };

    await createCursorFile(tempDir, "waymark", "list", listState);
    await createCursorFile(tempDir, "waymark", "search", searchState);

    const listResult = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    const searchResult = loadCursor({
      command: "search",
      toolName: "waymark",
    });

    expect(listResult?.cursor).toBe("list-cursor");
    expect(searchResult?.cursor).toBe("search-cursor");
  });

  test("scopes by context when provided", async () => {
    const projectAState: PaginationState = {
      cursor: "project-a-cursor",
      command: "list",
      context: "project-a",
      timestamp: Date.now(),
      hasMore: true,
    };

    const projectBState: PaginationState = {
      cursor: "project-b-cursor",
      command: "list",
      context: "project-b",
      timestamp: Date.now(),
      hasMore: true,
    };

    await createCursorFile(
      tempDir,
      "waymark",
      "list",
      projectAState,
      "project-a"
    );
    await createCursorFile(
      tempDir,
      "waymark",
      "list",
      projectBState,
      "project-b"
    );

    const projectAResult = loadCursor({
      command: "list",
      context: "project-a",
      toolName: "waymark",
    });

    const projectBResult = loadCursor({
      command: "list",
      context: "project-b",
      toolName: "waymark",
    });

    expect(projectAResult?.cursor).toBe("project-a-cursor");
    expect(projectBResult?.cursor).toBe("project-b-cursor");
  });

  test("uses toolName for XDG path resolution", async () => {
    const waymarkState: PaginationState = {
      cursor: "waymark-cursor",
      command: "list",
      timestamp: Date.now(),
      hasMore: true,
    };

    const pickmeState: PaginationState = {
      cursor: "pickme-cursor",
      command: "list",
      timestamp: Date.now(),
      hasMore: true,
    };

    await createCursorFile(tempDir, "waymark", "list", waymarkState);
    await createCursorFile(tempDir, "pickme", "list", pickmeState);

    const waymarkResult = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    const pickmeResult = loadCursor({
      command: "list",
      toolName: "pickme",
    });

    expect(waymarkResult?.cursor).toBe("waymark-cursor");
    expect(pickmeResult?.cursor).toBe("pickme-cursor");
  });

  test("handles corrupted state file gracefully (returns undefined)", async () => {
    // Write invalid JSON to the cursor file
    const cursorDir = join(tempDir, "waymark", "cursors", "list");
    await mkdir(cursorDir, { recursive: true });
    await writeFile(join(cursorDir, "cursor.json"), "{ invalid json", "utf-8");

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result).toBeUndefined();
  });

  test("returns undefined for empty JSON object", async () => {
    const cursorDir = join(tempDir, "waymark", "cursors", "list");
    await mkdir(cursorDir, { recursive: true });
    await writeFile(join(cursorDir, "cursor.json"), "{}", "utf-8");

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    // Should return undefined - cursor field is missing
    expect(result).toBeUndefined();
  });

  test("returns undefined when cursor field has wrong type", async () => {
    const cursorDir = join(tempDir, "waymark", "cursors", "list");
    await mkdir(cursorDir, { recursive: true });
    await writeFile(join(cursorDir, "cursor.json"), '{"cursor": 123}', "utf-8");

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    // Should return undefined - cursor must be a string, not a number
    expect(result).toBeUndefined();
  });

  test("returns undefined for expired cursors when maxAgeMs is exceeded", async () => {
    // Create a cursor with an old timestamp (1 hour ago)
    const oldState: PaginationState = {
      cursor: "old-cursor",
      command: "list",
      timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
      hasMore: true,
    };

    await createCursorFile(tempDir, "waymark", "list", oldState);

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
      maxAgeMs: 30 * 60 * 1000, // 30 minutes
    });

    expect(result).toBeUndefined();
  });

  test("returns state when cursor age is within maxAgeMs", async () => {
    const freshState: PaginationState = {
      cursor: "fresh-cursor",
      command: "list",
      timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
      hasMore: true,
    };

    await createCursorFile(tempDir, "waymark", "list", freshState);

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
      maxAgeMs: 30 * 60 * 1000, // 30 minutes
    });

    expect(result).toBeDefined();
    expect(result?.cursor).toBe("fresh-cursor");
  });

  test("includes hasMore and total from saved state", async () => {
    const stateWithTotal: PaginationState = {
      cursor: "cursor-with-total",
      command: "list",
      timestamp: Date.now(),
      hasMore: true,
      total: 100,
    };

    await createCursorFile(tempDir, "waymark", "list", stateWithTotal);

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result).toBeDefined();
    expect(result?.hasMore).toBe(true);
    expect(result?.total).toBe(100);
  });

  // =========================================================================
  // Security: Path Traversal Prevention
  // =========================================================================

  test("rejects path traversal in command", () => {
    expect(() =>
      loadCursor({
        command: "../../../etc/passwd",
        toolName: "waymark",
      })
    ).toThrow(/traversal|security/i);
  });

  test("rejects path traversal in context", () => {
    expect(() =>
      loadCursor({
        command: "list",
        context: "../../secrets",
        toolName: "waymark",
      })
    ).toThrow(/traversal|security/i);
  });

  test("rejects path traversal in toolName", () => {
    expect(() =>
      loadCursor({
        command: "list",
        toolName: "../../../malicious",
      })
    ).toThrow(/traversal|security/i);
  });
});

// =============================================================================
// saveCursor() Tests
// =============================================================================

describe("saveCursor()", () => {
  test("creates state file in XDG state directory", () => {
    saveCursor("new-cursor", {
      command: "list",
      toolName: "waymark",
    });

    // After saving, loading should return the cursor
    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result?.cursor).toBe("new-cursor");
  });

  test("persists cursor string", async () => {
    saveCursor("test-cursor-string", {
      command: "list",
      toolName: "waymark",
    });

    // Verify by reading the file directly
    const cursorPath = join(
      tempDir,
      "waymark",
      "cursors",
      "list",
      "cursor.json"
    );
    const content = await readFile(cursorPath, "utf-8");
    const parsed = JSON.parse(content) as PaginationState;

    expect(parsed.cursor).toBe("test-cursor-string");
  });

  test("persists command and context", async () => {
    saveCursor("cursor-with-context", {
      command: "search",
      context: "my-project",
      toolName: "waymark",
    });

    // Verify by reading the file directly
    const cursorPath = join(
      tempDir,
      "waymark",
      "cursors",
      "search",
      "my-project",
      "cursor.json"
    );
    const content = await readFile(cursorPath, "utf-8");
    const parsed = JSON.parse(content) as PaginationState;

    expect(parsed.command).toBe("search");
    expect(parsed.context).toBe("my-project");
  });

  test("adds timestamp automatically", async () => {
    const beforeSave = Date.now();

    saveCursor("timestamped-cursor", {
      command: "list",
      toolName: "waymark",
    });

    const afterSave = Date.now();

    // Verify timestamp is within the save window
    const cursorPath = join(
      tempDir,
      "waymark",
      "cursors",
      "list",
      "cursor.json"
    );
    const content = await readFile(cursorPath, "utf-8");
    const parsed = JSON.parse(content) as PaginationState;

    expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeSave);
    expect(parsed.timestamp).toBeLessThanOrEqual(afterSave);
  });

  test("overwrites existing cursor for same command", async () => {
    // Save initial cursor
    saveCursor("first-cursor", {
      command: "list",
      toolName: "waymark",
    });

    // Overwrite with new cursor
    saveCursor("second-cursor", {
      command: "list",
      toolName: "waymark",
    });

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result?.cursor).toBe("second-cursor");
  });

  test("maintains separate cursors for different commands", () => {
    saveCursor("list-cursor", {
      command: "list",
      toolName: "waymark",
    });

    saveCursor("search-cursor", {
      command: "search",
      toolName: "waymark",
    });

    const listResult = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    const searchResult = loadCursor({
      command: "search",
      toolName: "waymark",
    });

    expect(listResult?.cursor).toBe("list-cursor");
    expect(searchResult?.cursor).toBe("search-cursor");
  });

  test("maintains separate cursors for different contexts", () => {
    saveCursor("context-a-cursor", {
      command: "list",
      context: "context-a",
      toolName: "waymark",
    });

    saveCursor("context-b-cursor", {
      command: "list",
      context: "context-b",
      toolName: "waymark",
    });

    const contextAResult = loadCursor({
      command: "list",
      context: "context-a",
      toolName: "waymark",
    });

    const contextBResult = loadCursor({
      command: "list",
      context: "context-b",
      toolName: "waymark",
    });

    expect(contextAResult?.cursor).toBe("context-a-cursor");
    expect(contextBResult?.cursor).toBe("context-b-cursor");
  });

  test("creates parent directories if needed", async () => {
    // Use a fresh temp dir with no pre-existing structure
    const freshTempDir = await createTempDir();
    process.env.XDG_STATE_HOME = freshTempDir;

    // This should create all necessary directories
    saveCursor("deeply-nested-cursor", {
      command: "deeply-nested-command",
      context: "some-context",
      toolName: "new-tool",
    });

    const result = loadCursor({
      command: "deeply-nested-command",
      context: "some-context",
      toolName: "new-tool",
    });

    expect(result?.cursor).toBe("deeply-nested-cursor");

    // Cleanup
    await rm(freshTempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // API: Optional Fields Persistence
  // =========================================================================

  test("persists hasMore flag", () => {
    saveCursor("cursor-with-hasmore", {
      command: "list",
      toolName: "waymark",
      hasMore: true,
    });

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result?.hasMore).toBe(true);
  });

  test("persists total count", () => {
    saveCursor("cursor-with-total", {
      command: "list",
      toolName: "waymark",
      total: 100,
    });

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result?.total).toBe(100);
  });

  test("handles empty cursor string", () => {
    saveCursor("", {
      command: "list",
      toolName: "waymark",
    });

    const result = loadCursor({
      command: "list",
      toolName: "waymark",
    });

    expect(result?.cursor).toBe("");
  });

  // =========================================================================
  // Security: Path Traversal Prevention
  // =========================================================================

  test("rejects path traversal in command", () => {
    expect(() =>
      saveCursor("malicious-cursor", {
        command: "../../../etc/passwd",
        toolName: "waymark",
      })
    ).toThrow(/traversal|security/i);
  });

  test("rejects path traversal in context", () => {
    expect(() =>
      saveCursor("malicious-cursor", {
        command: "list",
        context: "../../secrets",
        toolName: "waymark",
      })
    ).toThrow(/traversal|security/i);
  });

  test("rejects path traversal in toolName", () => {
    expect(() =>
      saveCursor("malicious-cursor", {
        command: "list",
        toolName: "../../../malicious",
      })
    ).toThrow(/traversal|security/i);
  });
});

// =============================================================================
// clearCursor() Tests
// =============================================================================

describe("clearCursor()", () => {
  test("removes cursor file for command", async () => {
    // First save a cursor
    const state: PaginationState = {
      cursor: "cursor-to-clear",
      command: "list",
      timestamp: Date.now(),
      hasMore: true,
    };
    await createCursorFile(tempDir, "waymark", "list", state);

    // Verify it exists
    const beforeClear = loadCursor({
      command: "list",
      toolName: "waymark",
    });
    expect(beforeClear).toBeDefined();

    // Clear the cursor
    clearCursor({
      command: "list",
      toolName: "waymark",
    });

    // Verify it's gone
    const afterClear = loadCursor({
      command: "list",
      toolName: "waymark",
    });
    expect(afterClear).toBeUndefined();
  });

  test("does not throw if cursor does not exist", () => {
    // Should not throw when clearing a non-existent cursor
    expect(() => {
      clearCursor({
        command: "nonexistent-command",
        toolName: "waymark",
      });
    }).not.toThrow();
  });

  test("only clears matching command/context", async () => {
    // Create multiple cursors
    const listState: PaginationState = {
      cursor: "list-cursor",
      command: "list",
      timestamp: Date.now(),
      hasMore: true,
    };

    const searchState: PaginationState = {
      cursor: "search-cursor",
      command: "search",
      timestamp: Date.now(),
      hasMore: true,
    };

    await createCursorFile(tempDir, "waymark", "list", listState);
    await createCursorFile(tempDir, "waymark", "search", searchState);

    // Clear only list command
    clearCursor({
      command: "list",
      toolName: "waymark",
    });

    // List should be gone, search should remain
    const listResult = loadCursor({
      command: "list",
      toolName: "waymark",
    });
    expect(listResult).toBeUndefined();

    const searchResult = loadCursor({
      command: "search",
      toolName: "waymark",
    });
    expect(searchResult?.cursor).toBe("search-cursor");
  });

  test("leaves other commands' cursors intact", async () => {
    // Create cursors for multiple commands
    const commands = ["list", "search", "get", "delete"];

    for (const cmd of commands) {
      const state: PaginationState = {
        cursor: `${cmd}-cursor`,
        command: cmd,
        timestamp: Date.now(),
        hasMore: true,
      };
      await createCursorFile(tempDir, "waymark", cmd, state);
    }

    // Clear only 'list'
    clearCursor({
      command: "list",
      toolName: "waymark",
    });

    // Verify list is gone
    expect(
      loadCursor({
        command: "list",
        toolName: "waymark",
      })
    ).toBeUndefined();

    // Verify others remain
    for (const cmd of ["search", "get", "delete"]) {
      const result = loadCursor({
        command: cmd,
        toolName: "waymark",
      });
      expect(result?.cursor).toBe(`${cmd}-cursor`);
    }
  });

  test("respects context scoping", async () => {
    // Create cursors for different contexts
    const contextAState: PaginationState = {
      cursor: "context-a-cursor",
      command: "list",
      context: "context-a",
      timestamp: Date.now(),
      hasMore: true,
    };

    const contextBState: PaginationState = {
      cursor: "context-b-cursor",
      command: "list",
      context: "context-b",
      timestamp: Date.now(),
      hasMore: true,
    };

    await createCursorFile(
      tempDir,
      "waymark",
      "list",
      contextAState,
      "context-a"
    );
    await createCursorFile(
      tempDir,
      "waymark",
      "list",
      contextBState,
      "context-b"
    );

    // Clear only context-a
    clearCursor({
      command: "list",
      context: "context-a",
      toolName: "waymark",
    });

    // Verify context-a is gone
    expect(
      loadCursor({
        command: "list",
        context: "context-a",
        toolName: "waymark",
      })
    ).toBeUndefined();

    // Verify context-b remains
    const contextBResult = loadCursor({
      command: "list",
      context: "context-b",
      toolName: "waymark",
    });
    expect(contextBResult?.cursor).toBe("context-b-cursor");
  });

  test("handles missing state directory gracefully", () => {
    // Set XDG_STATE_HOME to a non-existent directory
    process.env.XDG_STATE_HOME = "/nonexistent/path/that/does/not/exist";

    // Should not throw
    expect(() => {
      clearCursor({
        command: "list",
        toolName: "waymark",
      });
    }).not.toThrow();
  });

  test("handles clearing command when directory exists but file doesn't", async () => {
    const cursorDir = join(tempDir, "waymark", "cursors", "orphan-command");
    await mkdir(cursorDir, { recursive: true });
    // Directory exists, no file inside

    expect(() =>
      clearCursor({
        command: "orphan-command",
        toolName: "waymark",
      })
    ).not.toThrow();
  });

  // =========================================================================
  // Security: Path Traversal Prevention
  // =========================================================================

  test("rejects path traversal in command", () => {
    expect(() =>
      clearCursor({
        command: "../../../etc/passwd",
        toolName: "waymark",
      })
    ).toThrow(/traversal|security/i);
  });

  test("rejects path traversal in context", () => {
    expect(() =>
      clearCursor({
        command: "list",
        context: "../../secrets",
        toolName: "waymark",
      })
    ).toThrow(/traversal|security/i);
  });

  test("rejects path traversal in toolName", () => {
    expect(() =>
      clearCursor({
        command: "list",
        toolName: "../../../malicious",
      })
    ).toThrow(/traversal|security/i);
  });
});

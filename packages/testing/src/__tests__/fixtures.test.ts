/**
 * @outfitter/testing - Fixtures Test Suite
 *
 * TDD RED PHASE: These tests document expected behavior and WILL FAIL
 * until implementation is complete.
 *
 * Test categories:
 * 1. createFixture (5 tests)
 * 2. withTempDir (4 tests)
 * 3. withEnv (4 tests)
 * 4. loadFixture (2 tests)
 */

import { afterEach, describe, expect, it } from "bun:test";
import { access, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFixture,
  loadFixture,
  withEnv,
  withTempDir,
} from "../fixtures.js";

// ============================================================================
// 1. createFixture Tests
// ============================================================================

describe("createFixture()", () => {
  it("creates a factory function that returns objects with defaults", () => {
    const createUser = createFixture({
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      active: true,
    });

    const user = createUser();

    expect(user.id).toBe(1);
    expect(user.name).toBe("John Doe");
    expect(user.email).toBe("john@example.com");
    expect(user.active).toBe(true);
  });

  it("allows overriding default values", () => {
    const createUser = createFixture({
      id: 1,
      name: "John Doe",
      email: "john@example.com",
    });

    const user = createUser({ name: "Jane Doe", email: "jane@example.com" });

    expect(user.id).toBe(1); // Default preserved
    expect(user.name).toBe("Jane Doe"); // Overridden
    expect(user.email).toBe("jane@example.com"); // Overridden
  });

  it("performs deep merging for nested objects", () => {
    const createConfig = createFixture({
      server: {
        port: 3000,
        host: "localhost",
      },
      database: {
        url: "postgres://localhost/db",
        pool: {
          min: 1,
          max: 10,
        },
      },
    });

    const config = createConfig({
      server: { port: 8080 },
      database: { pool: { max: 20 } },
    });

    expect(config.server.port).toBe(8080); // Overridden
    expect(config.server.host).toBe("localhost"); // Default preserved
    expect(config.database.url).toBe("postgres://localhost/db"); // Default preserved
    expect(config.database.pool.min).toBe(1); // Default preserved
    expect(config.database.pool.max).toBe(20); // Overridden
  });

  it("returns a new object each time (not the same reference)", () => {
    const createUser = createFixture({ id: 1, name: "John" });

    const user1 = createUser();
    const user2 = createUser();

    expect(user1).not.toBe(user2); // Different references
    expect(user1).toEqual(user2); // Same values
  });

  it("does not mutate the defaults object", () => {
    const defaults = { id: 1, name: "John", nested: { value: 42 } };
    const createUser = createFixture(defaults);

    createUser({ name: "Jane", nested: { value: 100 } });

    expect(defaults.name).toBe("John");
    expect(defaults.nested.value).toBe(42);
  });
});

// ============================================================================
// 2. withTempDir Tests
// ============================================================================

describe("withTempDir()", () => {
  it("creates a temporary directory and passes it to the callback", async () => {
    let capturedDir: string | undefined;

    await withTempDir(async (dir) => {
      capturedDir = dir;
      // Verify directory exists
      const stats = await stat(dir);
      expect(stats.isDirectory()).toBe(true);
    });

    expect(capturedDir).toBeDefined();
    expect(capturedDir?.startsWith(tmpdir())).toBe(true);
  });

  it("cleans up the temporary directory after callback completes", async () => {
    let capturedDir: string | undefined;

    await withTempDir(async (dir) => {
      capturedDir = dir;
      // Create some files to ensure cleanup handles non-empty dirs
      await Bun.write(join(dir, "test.txt"), "content");
    });

    // Directory should no longer exist
    expect(capturedDir).toBeDefined();
    const exists = await access(capturedDir as string)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("cleans up even when callback throws an error", async () => {
    let capturedDir: string | undefined;

    try {
      await withTempDir(async (dir) => {
        capturedDir = dir;
        throw new Error("Callback failed");
      });
    } catch {
      // Expected
    }

    // Directory should still be cleaned up
    expect(capturedDir).toBeDefined();
    const existsAfterError = await access(capturedDir as string)
      .then(() => true)
      .catch(() => false);
    expect(existsAfterError).toBe(false);
  });

  it("returns the value from the callback", async () => {
    const result = await withTempDir(async (dir) => {
      return { path: dir, computed: 42 };
    });

    expect(result.computed).toBe(42);
    expect(typeof result.path).toBe("string");
  });
});

// ============================================================================
// 3. withEnv Tests
// ============================================================================

describe("withEnv()", () => {
  const originalTestVar = process.env.TEST_VAR_123;

  afterEach(() => {
    // Restore original state
    if (originalTestVar === undefined) {
      delete process.env.TEST_VAR_123;
    } else {
      process.env.TEST_VAR_123 = originalTestVar;
    }
  });

  it("sets environment variables for the duration of the callback", async () => {
    let capturedValue: string | undefined;

    await withEnv({ TEST_VAR_123: "test-value" }, async () => {
      capturedValue = process.env.TEST_VAR_123;
    });

    expect(capturedValue).toBe("test-value");
  });

  it("restores original environment variables after callback", async () => {
    process.env.TEST_VAR_123 = "original";

    await withEnv({ TEST_VAR_123: "modified" }, async () => {
      expect(process.env.TEST_VAR_123).toBe("modified");
    });

    expect(process.env.TEST_VAR_123).toBe("original");
  });

  it("restores environment variables even when callback throws", async () => {
    process.env.TEST_VAR_123 = "original";

    try {
      await withEnv({ TEST_VAR_123: "modified" }, async () => {
        throw new Error("Callback failed");
      });
    } catch {
      // Expected
    }

    expect(process.env.TEST_VAR_123).toBe("original");
  });

  it("handles multiple environment variables at once", async () => {
    const vars = {
      TEST_A: "value-a",
      TEST_B: "value-b",
      TEST_C: "value-c",
    };

    await withEnv(vars, async () => {
      expect(process.env.TEST_A).toBe("value-a");
      expect(process.env.TEST_B).toBe("value-b");
      expect(process.env.TEST_C).toBe("value-c");
    });

    // All should be restored
    expect(process.env.TEST_A).toBeUndefined();
    expect(process.env.TEST_B).toBeUndefined();
    expect(process.env.TEST_C).toBeUndefined();
  });
});

// ============================================================================
// 4. loadFixture Tests
// ============================================================================

describe("loadFixture()", () => {
  const fixturesDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "__fixtures__"
  );

  it("parses JSON fixtures", () => {
    const note = loadFixture<{ id: string; title: string }>("mcp/notes.json", {
      fixturesDir,
    });

    expect(note.id).toBe("note-1");
    expect(note.title).toBe("Sample Note");
  });

  it("returns non-JSON fixtures as strings", () => {
    const config = loadFixture("mcp/config.toml", { fixturesDir });

    expect(config).toContain('title = "Outfitter"');
  });
});

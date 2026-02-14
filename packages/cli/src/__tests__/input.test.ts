/**
 * Tests for CLI input utilities.
 *
 * This is the RED phase of TDD - all tests should fail with "not implemented".
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectIds,
  expandFileArg,
  normalizeId,
  parseFilter,
  parseGlob,
  parseKeyValue,
  parseRange,
  parseSortSpec,
} from "../input.js";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a temporary directory for test fixtures.
 * Returns cleanup function.
 */
async function createTempDir(): Promise<{
  path: string;
  cleanup: () => Promise<void>;
}> {
  const path = join(
    tmpdir(),
    `cli-input-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(path, { recursive: true });
  return {
    path,
    cleanup: async () => {
      await rm(path, { recursive: true, force: true });
    },
  };
}

/**
 * Mock stdin for testing @- input.
 */
function mockStdin(content: string): { restore: () => void } {
  const originalStdin = process.stdin;
  const mockStream = {
    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array, void, unknown> {
      yield Buffer.from(content);
    },
    isTTY: false,
  };

  // @ts-expect-error - mocking stdin
  process.stdin = mockStream;

  return {
    restore: () => {
      // @ts-expect-error - restoring stdin
      process.stdin = originalStdin;
    },
  };
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let originalEnv: NodeJS.ProcessEnv;
let originalIsTTY: boolean | undefined;

beforeEach(() => {
  originalEnv = { ...process.env };
  originalIsTTY = process.stdout.isTTY;
  process.env.TERM = "xterm-256color";
});

afterEach(() => {
  process.env = originalEnv;
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalIsTTY,
    writable: true,
    configurable: true,
  });
});

// =============================================================================
// collectIds() Tests - 12 tests
// =============================================================================

describe("collectIds()", () => {
  test("handles single ID string", async () => {
    const result = await collectIds("my-id");
    expect(result).toEqual(["my-id"]);
  });

  test("handles space-separated IDs: 'id1 id2 id3'", async () => {
    const result = await collectIds("id1 id2 id3");
    expect(result).toEqual(["id1", "id2", "id3"]);
  });

  test("handles comma-separated IDs: 'id1,id2,id3'", async () => {
    const result = await collectIds("id1,id2,id3");
    expect(result).toEqual(["id1", "id2", "id3"]);
  });

  test("handles mixed separators", async () => {
    const result = await collectIds("id1,id2 id3, id4");
    expect(result).toEqual(["id1", "id2", "id3", "id4"]);
  });

  test("handles array input (repeated flags)", async () => {
    const result = await collectIds(["id1", "id2", "id3"]);
    expect(result).toEqual(["id1", "id2", "id3"]);
  });

  test("deduplicates IDs", async () => {
    const result = await collectIds("id1,id2,id1,id3,id2");
    expect(result).toEqual(["id1", "id2", "id3"]);
  });

  test("returns empty array for empty input", async () => {
    const result = await collectIds("");
    expect(result).toEqual([]);
  });

  test("expands @file reference (when allowFile: true)", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "ids.txt");
      await writeFile(filePath, "id1\nid2\nid3\n");

      const result = await collectIds(`@${filePath}`, { allowFile: true });
      expect(result).toEqual(["id1", "id2", "id3"]);
    } finally {
      await temp.cleanup();
    }
  });

  test("handles @- for stdin", async () => {
    const stdinMock = mockStdin("id1\nid2\nid3\n");
    try {
      const result = await collectIds("@-", { allowStdin: true });
      expect(result).toEqual(["id1", "id2", "id3"]);
    } finally {
      stdinMock.restore();
    }
  });

  test("throws for @file when allowFile: false", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "ids.txt");
      await writeFile(filePath, "id1\nid2\n");

      await expect(
        collectIds(`@${filePath}`, { allowFile: false })
      ).rejects.toThrow();
    } finally {
      await temp.cleanup();
    }
  });

  test("handles file with one ID per line", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "ids.txt");
      await writeFile(filePath, "first-id\nsecond-id\nthird-id");

      const result = await collectIds(`@${filePath}`, { allowFile: true });
      expect(result).toEqual(["first-id", "second-id", "third-id"]);
    } finally {
      await temp.cleanup();
    }
  });

  test("throws for non-existent @file", async () => {
    await expect(
      collectIds("@/nonexistent/path/ids.txt", { allowFile: true })
    ).rejects.toThrow();
  });

  test("rejects path traversal in @file reference", async () => {
    // Path traversal attempts should be rejected for security
    await expect(
      collectIds("@../../../etc/passwd", { allowFile: true })
    ).rejects.toThrow(/security|traversal|path/i);
    await expect(
      collectIds("@/tmp/../../../etc/passwd", { allowFile: true })
    ).rejects.toThrow(/security|traversal|path/i);
  });
});

// =============================================================================
// expandFileArg() Tests - 8 tests
// =============================================================================

describe("expandFileArg()", () => {
  test("returns literal string unchanged", async () => {
    const result = await expandFileArg("just a string");
    expect(result).toBe("just a string");
  });

  test("expands @path to file contents", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "content.txt");
      await writeFile(filePath, "file content here");

      const result = await expandFileArg(`@${filePath}`);
      expect(result).toBe("file content here");
    } finally {
      await temp.cleanup();
    }
  });

  test("handles @- for stdin", async () => {
    const stdinMock = mockStdin("stdin content");
    try {
      const result = await expandFileArg("@-");
      expect(result).toBe("stdin content");
    } finally {
      stdinMock.restore();
    }
  });

  test("trims content when trim: true", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "content.txt");
      await writeFile(filePath, "  content with whitespace  \n");

      const result = await expandFileArg(`@${filePath}`, { trim: true });
      expect(result).toBe("content with whitespace");
    } finally {
      await temp.cleanup();
    }
  });

  test("respects maxSize limit", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "large.txt");
      await writeFile(filePath, "A".repeat(1000));

      await expect(
        expandFileArg(`@${filePath}`, { maxSize: 100 })
      ).rejects.toThrow();
    } finally {
      await temp.cleanup();
    }
  });

  test("uses specified encoding", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "content.txt");
      // Write UTF-8 content
      await writeFile(filePath, "Hello World", "utf-8");

      const result = await expandFileArg(`@${filePath}`, { encoding: "utf-8" });
      expect(result).toBe("Hello World");
    } finally {
      await temp.cleanup();
    }
  });

  test("throws for non-existent file", async () => {
    await expect(
      expandFileArg("@/nonexistent/path/file.txt")
    ).rejects.toThrow();
  });

  test("throws when file exceeds maxSize", async () => {
    const temp = await createTempDir();
    try {
      const filePath = join(temp.path, "big.txt");
      await writeFile(filePath, "X".repeat(500));

      await expect(
        expandFileArg(`@${filePath}`, { maxSize: 100 })
      ).rejects.toThrow();
    } finally {
      await temp.cleanup();
    }
  });

  test("rejects path traversal in file argument", async () => {
    // Path traversal attempts should be rejected for security
    await expect(expandFileArg("@../../../etc/passwd")).rejects.toThrow(
      /security|traversal|path/i
    );
    await expect(expandFileArg("@/tmp/../../../etc/passwd")).rejects.toThrow(
      /security|traversal|path/i
    );
  });
});

// =============================================================================
// parseGlob() Tests - 8 tests
// =============================================================================

describe("parseGlob()", () => {
  test("expands simple glob pattern", async () => {
    const temp = await createTempDir();
    try {
      await writeFile(join(temp.path, "file1.ts"), "");
      await writeFile(join(temp.path, "file2.ts"), "");
      await writeFile(join(temp.path, "file3.js"), "");

      const result = await parseGlob("*.ts", { cwd: temp.path });
      expect(result.sort()).toEqual(["file1.ts", "file2.ts"].sort());
    } finally {
      await temp.cleanup();
    }
  });

  test("expands recursive glob: **/*.ts", async () => {
    const temp = await createTempDir();
    try {
      await mkdir(join(temp.path, "src"), { recursive: true });
      await writeFile(join(temp.path, "root.ts"), "");
      await writeFile(join(temp.path, "src", "nested.ts"), "");

      const result = await parseGlob("**/*.ts", { cwd: temp.path });
      expect(result.length).toBe(2);
      expect(result.some((f) => f.includes("nested.ts"))).toBe(true);
    } finally {
      await temp.cleanup();
    }
  });

  test("respects ignore patterns", async () => {
    const temp = await createTempDir();
    try {
      await mkdir(join(temp.path, "node_modules"), { recursive: true });
      await writeFile(join(temp.path, "app.ts"), "");
      await writeFile(join(temp.path, "node_modules", "dep.ts"), "");

      const result = await parseGlob("**/*.ts", {
        cwd: temp.path,
        ignore: ["node_modules/**"],
      });
      expect(result.length).toBe(1);
      expect(result[0]).toContain("app.ts");
    } finally {
      await temp.cleanup();
    }
  });

  test("respects onlyFiles option", async () => {
    const temp = await createTempDir();
    try {
      await mkdir(join(temp.path, "subdir"), { recursive: true });
      await writeFile(join(temp.path, "file.ts"), "");

      const result = await parseGlob("*", { cwd: temp.path, onlyFiles: true });
      expect(result).toContain("file.ts");
      expect(result).not.toContain("subdir");
    } finally {
      await temp.cleanup();
    }
  });

  test("respects onlyDirectories option", async () => {
    const temp = await createTempDir();
    try {
      await mkdir(join(temp.path, "subdir"), { recursive: true });
      await writeFile(join(temp.path, "file.ts"), "");

      const result = await parseGlob("*", {
        cwd: temp.path,
        onlyDirectories: true,
      });
      expect(result).toContain("subdir");
      expect(result).not.toContain("file.ts");
    } finally {
      await temp.cleanup();
    }
  });

  test("uses cwd option", async () => {
    const temp = await createTempDir();
    try {
      await mkdir(join(temp.path, "nested"), { recursive: true });
      await writeFile(join(temp.path, "nested", "file.ts"), "");

      const result = await parseGlob("*.ts", {
        cwd: join(temp.path, "nested"),
      });
      expect(result).toContain("file.ts");
    } finally {
      await temp.cleanup();
    }
  });

  test("returns empty array for no matches", async () => {
    const temp = await createTempDir();
    try {
      await writeFile(join(temp.path, "file.js"), "");

      const result = await parseGlob("*.ts", { cwd: temp.path });
      expect(result).toEqual([]);
    } finally {
      await temp.cleanup();
    }
  });

  test("handles followSymlinks option", async () => {
    const temp = await createTempDir();
    try {
      await writeFile(join(temp.path, "real.ts"), "");
      // Note: Creating symlinks might require special permissions on some systems
      // The test verifies the option is accepted even if symlink creation fails

      const result = await parseGlob("*.ts", {
        cwd: temp.path,
        followSymlinks: true,
      });
      expect(Array.isArray(result)).toBe(true);
    } finally {
      await temp.cleanup();
    }
  });

  test("rejects glob patterns that escape workspace", async () => {
    const temp = await createTempDir();
    try {
      // Patterns that try to escape the workspace should be rejected
      await expect(parseGlob("../**/*.ts", { cwd: temp.path })).rejects.toThrow(
        /security|escape|workspace|traversal/i
      );
      await expect(
        parseGlob("../../../**/*.ts", { cwd: temp.path })
      ).rejects.toThrow(/security|escape|workspace|traversal/i);
    } finally {
      await temp.cleanup();
    }
  });
});

// =============================================================================
// parseKeyValue() Tests - 8 tests
// =============================================================================

describe("parseKeyValue()", () => {
  test("parses single key=value", () => {
    const result = parseKeyValue("name=John");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([{ key: "name", value: "John" }]);
    }
  });

  test("parses comma-separated pairs", () => {
    const result = parseKeyValue("name=John,age=30");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([
        { key: "name", value: "John" },
        { key: "age", value: "30" },
      ]);
    }
  });

  test("handles array input", () => {
    const result = parseKeyValue(["name=John", "age=30"]);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([
        { key: "name", value: "John" },
        { key: "age", value: "30" },
      ]);
    }
  });

  test("returns Result.ok for valid input", () => {
    const result = parseKeyValue("valid=input");
    expect(result.isOk()).toBe(true);
  });

  test("returns Result.err for missing equals", () => {
    const result = parseKeyValue("invalid-no-equals");
    expect(result.isErr()).toBe(true);
  });

  test("returns Result.err for empty key", () => {
    const result = parseKeyValue("=value");
    expect(result.isErr()).toBe(true);
  });

  test("handles values with equals: key=a=b", () => {
    const result = parseKeyValue("key=a=b=c");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([{ key: "key", value: "a=b=c" }]);
    }
  });

  test("handles empty value: key=", () => {
    const result = parseKeyValue("key=");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([{ key: "key", value: "" }]);
    }
  });

  test("uses = as default separator", () => {
    // Verify the default separator is = (no explicit separator option passed)
    const result = parseKeyValue("name=test");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.key).toBe("name");
      expect(result.value[0]?.value).toBe("test");
    }
  });
});

// =============================================================================
// parseRange() Tests - 10 tests
// =============================================================================

describe("parseRange()", () => {
  test("parses numeric range: 1-10", () => {
    const result = parseRange("1-10", "number");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ type: "number", min: 1, max: 10 });
    }
  });

  test("parses single number as min=max", () => {
    const result = parseRange("5", "number");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ type: "number", min: 5, max: 5 });
    }
  });

  test("returns err for invalid range (min > max)", () => {
    const result = parseRange("10-5", "number");
    expect(result.isErr()).toBe(true);
  });

  test("returns err for non-numeric in number mode", () => {
    const result = parseRange("abc-xyz", "number");
    expect(result.isErr()).toBe(true);
  });

  test("parses date range: 2024-01-01..2024-12-31", () => {
    const result = parseRange("2024-01-01..2024-12-31", "date");
    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.type === "date") {
      expect(result.value.start.getFullYear()).toBe(2024);
      expect(result.value.start.getMonth()).toBe(0); // January
      expect(result.value.end.getMonth()).toBe(11); // December
    }
  });

  test("parses single date as start=end", () => {
    const result = parseRange("2024-06-15", "date");
    expect(result.isOk()).toBe(true);
    if (result.isOk() && result.value.type === "date") {
      expect(result.value.start.getTime()).toBe(result.value.end.getTime());
    }
  });

  test("returns err for invalid date format", () => {
    const result = parseRange("not-a-date", "date");
    expect(result.isErr()).toBe(true);
  });

  test("returns err for invalid date range (start > end)", () => {
    const result = parseRange("2024-12-31..2024-01-01", "date");
    expect(result.isErr()).toBe(true);
  });

  test("handles negative numbers", () => {
    const result = parseRange("-10--5", "number");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ type: "number", min: -10, max: -5 });
    }
  });

  test("handles whitespace", () => {
    const result = parseRange("  1 - 10  ", "number");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ type: "number", min: 1, max: 10 });
    }
  });
});

// =============================================================================
// parseFilter() Tests - 8 tests
// =============================================================================

describe("parseFilter()", () => {
  test("parses single filter: status:active", () => {
    const result = parseFilter("status:active");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([{ field: "status", value: "active" }]);
    }
  });

  test("parses multiple: status:active,priority:high", () => {
    const result = parseFilter("status:active,priority:high");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([
        { field: "status", value: "active" },
        { field: "priority", value: "high" },
      ]);
    }
  });

  test("handles operators: age:>30", () => {
    const result = parseFilter("age:>30");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.field).toBe("age");
      expect(result.value[0]?.operator).toBe("gt");
      expect(result.value[0]?.value).toBe("30");
    }
  });

  test("handles negation: !status:draft", () => {
    const result = parseFilter("!status:draft");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.operator).toBe("ne");
      expect(result.value[0]?.field).toBe("status");
      expect(result.value[0]?.value).toBe("draft");
    }
  });

  test("returns err for invalid format", () => {
    const result = parseFilter("invalid-no-colon");
    expect(result.isErr()).toBe(true);
  });

  test("handles values with colons", () => {
    const result = parseFilter("time:12:30:00");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.field).toBe("time");
      expect(result.value[0]?.value).toBe("12:30:00");
    }
  });

  test("handles empty filter string", () => {
    const result = parseFilter("");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
  });

  test("handles whitespace", () => {
    const result = parseFilter("  status : active , priority : high  ");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(2);
    }
  });
});

// =============================================================================
// parseSortSpec() Tests - 6 tests
// =============================================================================

describe("parseSortSpec()", () => {
  test("parses single: modified:desc", () => {
    const result = parseSortSpec("modified:desc");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([{ field: "modified", direction: "desc" }]);
    }
  });

  test("parses multiple: modified:desc,title:asc", () => {
    const result = parseSortSpec("modified:desc,title:asc");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([
        { field: "modified", direction: "desc" },
        { field: "title", direction: "asc" },
      ]);
    }
  });

  test("defaults to asc when direction omitted", () => {
    const result = parseSortSpec("name");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([{ field: "name", direction: "asc" }]);
    }
  });

  test("returns err for invalid direction", () => {
    const result = parseSortSpec("name:invalid");
    expect(result.isErr()).toBe(true);
  });

  test("handles empty input", () => {
    const result = parseSortSpec("");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
  });

  test("handles whitespace", () => {
    const result = parseSortSpec("  modified : desc , title : asc  ");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.length).toBe(2);
    }
  });
});

// =============================================================================
// normalizeId() Tests - 8 tests
// =============================================================================

describe("normalizeId()", () => {
  test("trims whitespace when trim: true", () => {
    const result = normalizeId("  my-id  ", { trim: true });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("my-id");
    }
  });

  test("lowercases when lowercase: true", () => {
    const result = normalizeId("MY-ID", { lowercase: true });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("my-id");
    }
  });

  test("returns err when below minLength", () => {
    const result = normalizeId("ab", { minLength: 3 });
    expect(result.isErr()).toBe(true);
  });

  test("returns err when above maxLength", () => {
    const result = normalizeId("this-is-a-very-long-id", { maxLength: 10 });
    expect(result.isErr()).toBe(true);
  });

  test("returns err when pattern not matched", () => {
    const result = normalizeId("invalid id!", { pattern: /^[a-z-]+$/ });
    expect(result.isErr()).toBe(true);
  });

  test("passes through valid ID unchanged", () => {
    const result = normalizeId("valid-id");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("valid-id");
    }
  });

  test("applies multiple normalizations", () => {
    const result = normalizeId("  MY-ID-123  ", {
      trim: true,
      lowercase: true,
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("my-id-123");
    }
  });

  test("handles empty string", () => {
    const result = normalizeId("", { minLength: 1 });
    expect(result.isErr()).toBe(true);
  });
});

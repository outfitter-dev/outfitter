/**
 * Tests for output truncation with pagination hints and file pointers.
 *
 * Covers validation contract assertions:
 * - VAL-CTX-001: Output truncation is configurable and off by default
 * - VAL-CTX-002: Above-limit output is explicitly truncated
 * - VAL-CTX-003: Truncation includes pagination continuation hints
 * - VAL-CTX-004: File pointers for very large output
 * - VAL-CTX-005: File pointer write failure degrades gracefully
 *
 * @packageDocumentation
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_FILE_POINTER_THRESHOLD,
  truncateOutput,
  type TruncationOptions,
  type TruncationResult,
} from "../truncation.js";

// =============================================================================
// Test Helpers
// =============================================================================

/** Generate an array of test items. */
function generateItems(count: number): { id: number; name: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `item-${i + 1}`,
  }));
}

/** Track files created during tests for cleanup. */
const createdFiles: string[] = [];

afterEach(() => {
  for (const file of createdFiles) {
    try {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    } catch {
      // Ignore cleanup failures
    }
  }
  createdFiles.length = 0;
});

// =============================================================================
// VAL-CTX-001: Output truncation is configurable and off by default
// =============================================================================

describe("truncation off by default (VAL-CTX-001)", () => {
  test("returns data untouched when no limit is configured", () => {
    const items = generateItems(10);
    const result = truncateOutput(items, {});

    expect(result.data).toEqual(items);
    expect(result.metadata).toBeUndefined();
    expect(result.hints).toEqual([]);
  });

  test("returns data untouched when limit is undefined", () => {
    const items = generateItems(5);
    const result = truncateOutput(items, { limit: undefined });

    expect(result.data).toEqual(items);
    expect(result.metadata).toBeUndefined();
    expect(result.hints).toEqual([]);
  });

  test("returns data untouched when data length is below limit", () => {
    const items = generateItems(5);
    const result = truncateOutput(items, { limit: 10 });

    expect(result.data).toEqual(items);
    expect(result.metadata).toBeUndefined();
    expect(result.hints).toEqual([]);
  });

  test("returns data untouched when data length equals limit", () => {
    const items = generateItems(10);
    const result = truncateOutput(items, { limit: 10 });

    expect(result.data).toEqual(items);
    expect(result.metadata).toBeUndefined();
    expect(result.hints).toEqual([]);
  });

  test("handles empty array with no limit", () => {
    const result = truncateOutput([], {});

    expect(result.data).toEqual([]);
    expect(result.metadata).toBeUndefined();
    expect(result.hints).toEqual([]);
  });

  test("handles empty array with limit", () => {
    const result = truncateOutput([], { limit: 10 });

    expect(result.data).toEqual([]);
    expect(result.metadata).toBeUndefined();
    expect(result.hints).toEqual([]);
  });

  test("passes through non-array data untouched", () => {
    const data = { key: "value" };
    // Non-array data should not be truncated
    const result = truncateOutput(data as unknown as unknown[], {
      limit: 1,
    });

    // Non-array data should pass through
    expect(result.data).toEqual(data);
    expect(result.metadata).toBeUndefined();
    expect(result.hints).toEqual([]);
  });
});

// =============================================================================
// VAL-CTX-002: Above-limit output is explicitly truncated
// =============================================================================

describe("above-limit output is truncated (VAL-CTX-002)", () => {
  test("truncates array to limit items when exceeding limit", () => {
    const items = generateItems(20);
    const result = truncateOutput(items, { limit: 10 });

    expect(result.data).toHaveLength(10);
    expect(result.data).toEqual(items.slice(0, 10));
  });

  test("includes showing/total/truncated metadata", () => {
    const items = generateItems(50);
    const result = truncateOutput(items, { limit: 20 });

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.showing).toBe(20);
    expect(result.metadata!.total).toBe(50);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("handles limit of 1", () => {
    const items = generateItems(5);
    const result = truncateOutput(items, { limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ id: 1, name: "item-1" });
    expect(result.metadata!.showing).toBe(1);
    expect(result.metadata!.total).toBe(5);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("respects offset when truncating", () => {
    const items = generateItems(20);
    const result = truncateOutput(items, { limit: 5, offset: 10 });

    expect(result.data).toHaveLength(5);
    expect(result.data).toEqual(items.slice(10, 15));
    expect(result.metadata!.showing).toBe(5);
    expect(result.metadata!.total).toBe(20);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("handles offset beyond data length", () => {
    const items = generateItems(10);
    const result = truncateOutput(items, { limit: 5, offset: 20 });

    expect(result.data).toHaveLength(0);
    expect(result.metadata!.showing).toBe(0);
    expect(result.metadata!.total).toBe(10);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("handles offset + limit exceeding data length", () => {
    const items = generateItems(10);
    const result = truncateOutput(items, { limit: 5, offset: 8 });

    expect(result.data).toHaveLength(2);
    expect(result.data).toEqual(items.slice(8, 10));
    expect(result.metadata!.showing).toBe(2);
    expect(result.metadata!.total).toBe(10);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("structured output (JSON) remains parseable after truncation", () => {
    const items = generateItems(100);
    const result = truncateOutput(items, { limit: 10 });

    // The data should be a valid JSON-serializable array
    const json = JSON.stringify(result.data);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(10);
  });

  test("structured output (JSONL) remains parseable after truncation", () => {
    const items = generateItems(100);
    const result = truncateOutput(items, { limit: 10 });

    // Each item should be individually serializable (JSONL requirement)
    for (const item of result.data) {
      const line = JSON.stringify(item);
      const parsed = JSON.parse(line);
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe("object");
    }
  });
});

// =============================================================================
// VAL-CTX-003: Truncation includes pagination continuation hints
// =============================================================================

describe("pagination continuation hints (VAL-CTX-003)", () => {
  test("includes CLIHint for continuation when truncated", () => {
    const items = generateItems(50);
    const result = truncateOutput(items, {
      limit: 20,
      commandName: "list items",
    });

    expect(result.hints.length).toBeGreaterThan(0);
    // At least one hint should reference pagination
    const paginationHint = result.hints.find(
      (h) => h.command && h.command.includes("--offset")
    );
    expect(paginationHint).toBeDefined();
    expect(paginationHint!.command).toContain("--offset 20");
    expect(paginationHint!.command).toContain("--limit 20");
  });

  test("hint command includes the command name", () => {
    const items = generateItems(50);
    const result = truncateOutput(items, {
      limit: 20,
      commandName: "list items",
    });

    const paginationHint = result.hints.find(
      (h) => h.command && h.command.includes("--offset")
    );
    expect(paginationHint!.command).toContain("list items");
  });

  test("hint offset accounts for current offset", () => {
    const items = generateItems(100);
    const result = truncateOutput(items, {
      limit: 20,
      offset: 40,
      commandName: "search",
    });

    const paginationHint = result.hints.find(
      (h) => h.command && h.command.includes("--offset")
    );
    expect(paginationHint).toBeDefined();
    // Next offset should be current offset + limit
    expect(paginationHint!.command).toContain("--offset 60");
  });

  test("no pagination hint when offset + limit covers all data", () => {
    const items = generateItems(10);
    const result = truncateOutput(items, {
      limit: 5,
      offset: 5,
      commandName: "list",
    });

    // All remaining data is shown, no more pages
    const paginationHint = result.hints.find(
      (h) => h.command && h.command.includes("--offset")
    );
    expect(paginationHint).toBeUndefined();
  });

  test("hint has descriptive text", () => {
    const items = generateItems(50);
    const result = truncateOutput(items, {
      limit: 20,
      commandName: "list",
    });

    const paginationHint = result.hints.find(
      (h) => h.command && h.command.includes("--offset")
    );
    expect(paginationHint!.description).toBeTruthy();
    expect(typeof paginationHint!.description).toBe("string");
  });

  test("no hints when not truncated", () => {
    const items = generateItems(5);
    const result = truncateOutput(items, { limit: 10 });

    expect(result.hints).toEqual([]);
  });

  test("uses default command name when not provided", () => {
    const items = generateItems(50);
    const result = truncateOutput(items, { limit: 20 });

    const paginationHint = result.hints.find(
      (h) => h.command && h.command.includes("--offset")
    );
    expect(paginationHint).toBeDefined();
    // Should still generate a hint, even without command name
    expect(paginationHint!.command).toContain("--offset");
    expect(paginationHint!.command).toContain("--limit");
  });
});

// =============================================================================
// VAL-CTX-004: File pointers for very large output
// =============================================================================

describe("file pointers for very large output (VAL-CTX-004)", () => {
  test("includes full_output file pointer when output is very large", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);
    const result = truncateOutput(items, { limit: 20 });

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.full_output).toBeDefined();
    expect(typeof result.metadata!.full_output).toBe("string");

    // Track for cleanup
    if (result.metadata!.full_output) {
      createdFiles.push(result.metadata!.full_output);
    }
  });

  test("file pointer points to an existing file", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);
    const result = truncateOutput(items, { limit: 20 });

    const filePath = result.metadata!.full_output!;
    createdFiles.push(filePath);

    expect(existsSync(filePath)).toBe(true);
  });

  test("file contains the complete output as JSON", async () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 50);
    const result = truncateOutput(items, { limit: 20 });

    const filePath = result.metadata!.full_output!;
    createdFiles.push(filePath);

    const fileContent = Bun.file(filePath);
    const text = await fileContent.text();
    const parsed = JSON.parse(text);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(DEFAULT_FILE_POINTER_THRESHOLD + 50);
  });

  test("file path is in a safe temp directory", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);
    const result = truncateOutput(items, { limit: 20 });

    const filePath = result.metadata!.full_output!;
    createdFiles.push(filePath);

    // Must be under the OS temp directory
    const tempDir = tmpdir();
    expect(filePath.startsWith(tempDir)).toBe(true);
  });

  test("no file pointer when output is below file pointer threshold", () => {
    const items = generateItems(50);
    const result = truncateOutput(items, { limit: 20 });

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.full_output).toBeUndefined();
  });

  test("custom file pointer threshold is respected", () => {
    const items = generateItems(30);
    const result = truncateOutput(items, {
      limit: 10,
      filePointerThreshold: 20,
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.full_output).toBeDefined();

    if (result.metadata!.full_output) {
      createdFiles.push(result.metadata!.full_output);
    }
  });

  test("no file pointer when below custom threshold", () => {
    const items = generateItems(15);
    const result = truncateOutput(items, {
      limit: 10,
      filePointerThreshold: 20,
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.full_output).toBeUndefined();
  });
});

// =============================================================================
// VAL-CTX-005: File pointer write failure degrades gracefully
// =============================================================================

describe("file pointer write failure degrades gracefully (VAL-CTX-005)", () => {
  test("returns truncated output without crash when file write fails", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);

    // Use an invalid temp directory to force write failure
    const result = truncateOutput(items, {
      limit: 20,
      tempDir: "/nonexistent-path-that-should-not-exist/outfitter",
    });

    // Should still return truncated data
    expect(result.data).toHaveLength(20);
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.showing).toBe(20);
    expect(result.metadata!.total).toBe(DEFAULT_FILE_POINTER_THRESHOLD + 100);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("includes warning hint when file write fails", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);

    const result = truncateOutput(items, {
      limit: 20,
      tempDir: "/nonexistent-path-that-should-not-exist/outfitter",
    });

    // Should include a warning hint about the file write failure
    const warningHint = result.hints.find(
      (h) =>
        h.description.toLowerCase().includes("warning") ||
        h.description.toLowerCase().includes("full output") ||
        h.description.toLowerCase().includes("file")
    );
    expect(warningHint).toBeDefined();
  });

  test("no full_output field when file write fails", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);

    const result = truncateOutput(items, {
      limit: 20,
      tempDir: "/nonexistent-path-that-should-not-exist/outfitter",
    });

    expect(result.metadata!.full_output).toBeUndefined();
  });
});

// =============================================================================
// tempDir validation (safe directory constraints)
// =============================================================================

describe("tempDir validation rejects unsafe paths", () => {
  test("rejects relative path traversal and falls back to OS tmpdir", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);

    const result = truncateOutput(items, {
      limit: 20,
      tempDir: "../../../etc",
    });

    // Should reject unsafe tempDir and fall back to OS tmpdir
    expect(result.data).toHaveLength(20);
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.truncated).toBe(true);

    // Should fall back to OS tmpdir, writing the file successfully there
    expect(result.metadata!.full_output).toBeDefined();
    expect(result.metadata!.full_output!.startsWith(tmpdir())).toBe(true);

    if (result.metadata!.full_output) {
      createdFiles.push(result.metadata!.full_output);
    }
  });

  test("rejects tempDir containing .. traversal and falls back to OS tmpdir", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);

    const result = truncateOutput(items, {
      limit: 20,
      tempDir: "/tmp/safe/../../../etc",
    });

    // Should reject unsafe tempDir and fall back to OS tmpdir
    expect(result.data).toHaveLength(20);
    expect(result.metadata!.full_output).toBeDefined();
    expect(result.metadata!.full_output!.startsWith(tmpdir())).toBe(true);

    if (result.metadata!.full_output) {
      createdFiles.push(result.metadata!.full_output);
    }
  });

  test("accepts valid absolute path as tempDir", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);
    const validDir = tmpdir();

    const result = truncateOutput(items, {
      limit: 20,
      tempDir: validDir,
    });

    // Valid absolute path should work normally
    expect(result.metadata!.full_output).toBeDefined();
    expect(result.metadata!.full_output!.startsWith(validDir)).toBe(true);

    if (result.metadata!.full_output) {
      createdFiles.push(result.metadata!.full_output);
    }
  });

  test("rejects non-absolute tempDir and falls back to OS tmpdir", () => {
    const items = generateItems(DEFAULT_FILE_POINTER_THRESHOLD + 100);

    const result = truncateOutput(items, {
      limit: 20,
      tempDir: "relative/path",
    });

    // Should reject relative path and fall back to OS tmpdir
    expect(result.data).toHaveLength(20);
    expect(result.metadata!.full_output).toBeDefined();
    expect(result.metadata!.full_output!.startsWith(tmpdir())).toBe(true);

    if (result.metadata!.full_output) {
      createdFiles.push(result.metadata!.full_output);
    }
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("truncation edge cases", () => {
  test("limit of 0 returns empty array with metadata", () => {
    const items = generateItems(10);
    const result = truncateOutput(items, { limit: 0 });

    expect(result.data).toHaveLength(0);
    expect(result.metadata!.showing).toBe(0);
    expect(result.metadata!.total).toBe(10);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("negative offset is treated as 0", () => {
    const items = generateItems(10);
    const result = truncateOutput(items, { limit: 5, offset: -5 });

    expect(result.data).toEqual(items.slice(0, 5));
    expect(result.metadata!.showing).toBe(5);
  });

  test("preserves original data array (no mutation)", () => {
    const items = generateItems(10);
    const originalLength = items.length;
    const originalFirst = { ...items[0]! };

    truncateOutput(items, { limit: 3 });

    expect(items).toHaveLength(originalLength);
    expect(items[0]).toEqual(originalFirst);
  });

  test("works with items containing complex nested data", () => {
    const items = [
      { id: 1, nested: { deep: { value: true } }, tags: ["a", "b"] },
      { id: 2, nested: { deep: { value: false } }, tags: ["c"] },
      { id: 3, nested: { deep: { value: true } }, tags: [] },
    ];

    const result = truncateOutput(items, { limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual(items[0]);
    expect(result.data[1]).toEqual(items[1]);

    // Still parseable as JSON
    const json = JSON.stringify(result.data);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

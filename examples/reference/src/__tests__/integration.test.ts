/**
 * Integration tests verifying cross-feature composition.
 *
 * Verifies: output truncation, parseInput/expectOk/wrapError utilities,
 * schemas, and the full handler→CLI→envelope pipeline.
 */

import { describe, expect, test, beforeEach } from "bun:test";

import { truncateOutput } from "@outfitter/cli/truncation";
import {
  expectOk,
  NotFoundError,
  parseInput,
  Result,
  ValidationError,
  wrapError,
} from "@outfitter/contracts";
import type { HandlerContext } from "@outfitter/contracts";

import { seedStore, listTasks, createTask, resetStore } from "../handlers.js";
import { ListTasksInput, CreateTaskInput, TaskSchema } from "../schemas.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createTestContext(): HandlerContext {
  return {
    cwd: "/tmp",
    env: {},
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
    },
    requestId: "test-integration",
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

describe("parseInput utility", () => {
  test("returns Ok for valid input", () => {
    const result = parseInput(ListTasksInput, { status: "pending" });
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().status).toBe("pending");
  });

  test("returns Err(ValidationError) for invalid input", () => {
    const result = parseInput(CreateTaskInput, { title: "" });
    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("validation");
  });

  test("handles optional fields correctly", () => {
    const result = parseInput(ListTasksInput, {});
    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.status).toBeUndefined();
    expect(data.assignee).toBeUndefined();
  });
});

describe("expectOk utility", () => {
  test("unwraps Ok result", () => {
    const result = Result.ok(42);
    const value = expectOk(result);
    expect(value).toBe(42);
  });

  test("throws on Err result", () => {
    const result = Result.err(new ValidationError({ message: "bad input" }));
    expect(() => expectOk(result)).toThrow();
  });
});

describe("wrapError utility", () => {
  test("passes through OutfitterError unchanged", () => {
    const original = NotFoundError.create("task", "123");
    const wrapped = wrapError(original);
    expect(wrapped.category).toBe("not_found");
    expect(wrapped).toBe(original);
  });

  test("wraps unknown Error as InternalError", () => {
    const wrapped = wrapError(new Error("something failed"));
    expect(wrapped.category).toBe("internal");
  });

  test("wraps non-Error value as InternalError", () => {
    const wrapped = wrapError("string error");
    expect(wrapped.category).toBe("internal");
  });
});

// =============================================================================
// Output Truncation (v0.6)
// =============================================================================

describe("output truncation", () => {
  test("passes through when no limit configured", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const result = truncateOutput(items, {});
    expect(result.data.length).toBe(50);
    expect(result.metadata).toBeUndefined();
  });

  test("passes through when below limit", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const result = truncateOutput(items, { limit: 10 });
    expect(result.data.length).toBe(5);
    expect(result.metadata).toBeUndefined();
  });

  test("truncates when above limit with metadata", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const result = truncateOutput(items, {
      limit: 10,
      commandName: "task list",
    });
    expect(result.data.length).toBe(10);
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.showing).toBe(10);
    expect(result.metadata!.total).toBe(50);
    expect(result.metadata!.truncated).toBe(true);
  });

  test("includes pagination hints for continuation", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const result = truncateOutput(items, {
      limit: 10,
      commandName: "task list",
    });
    expect(result.hints.length).toBeGreaterThan(0);
    const nextPageHint = result.hints[0];
    expect(nextPageHint?.command).toContain("--offset 10");
    expect(nextPageHint?.command).toContain("--limit 10");
  });

  test("supports offset for pagination", () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const result = truncateOutput(items, {
      limit: 10,
      offset: 20,
      commandName: "task list",
    });
    expect(result.data.length).toBe(10);
    // First item should be at index 20
    expect((result.data[0] as { id: number }).id).toBe(20);
  });
});

// =============================================================================
// Schema Validation
// =============================================================================

describe("schema validation", () => {
  test("TaskSchema validates complete task objects", () => {
    const result = TaskSchema.safeParse({
      id: "1",
      title: "Test",
      status: "pending",
      assignee: "alice",
      tags: ["test"],
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  test("TaskSchema rejects invalid status", () => {
    const result = TaskSchema.safeParse({
      id: "1",
      title: "Test",
      status: "invalid",
      tags: [],
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Handler + Truncation Pipeline
// =============================================================================

describe("handler → truncation pipeline", () => {
  beforeEach(() => {
    resetStore();
    // Seed many tasks for truncation testing
    seedStore();
  });

  test("listTasks result can be truncated", async () => {
    const ctx = createTestContext();
    const result = await listTasks({}, ctx);
    expect(result.isOk()).toBe(true);
    const tasks = result.unwrap();
    const truncated = truncateOutput(tasks, {
      limit: 2,
      commandName: "task list",
    });
    expect(truncated.data.length).toBe(2);
    expect(truncated.metadata?.total).toBe(5);
    expect(truncated.hints.length).toBeGreaterThan(0);
  });
});

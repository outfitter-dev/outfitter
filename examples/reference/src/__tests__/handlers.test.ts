/**
 * Tests for transport-agnostic handlers.
 *
 * Verifies: Result types, error taxonomy, input validation,
 * streaming with ctx.progress, parseInput/wrapError utilities.
 */

import { describe, expect, test, beforeEach } from "bun:test";

import type { HandlerContext, StreamEvent } from "@outfitter/contracts";

import {
  analyzeTasks,
  createTask,
  deleteTask,
  getAllTasks,
  listTasks,
  resetStore,
  safeOperation,
  seedStore,
  updateTask,
} from "../handlers.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createTestContext(
  overrides?: Partial<HandlerContext>
): HandlerContext {
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
    requestId: "test-request-id",
    ...overrides,
  };
}

// =============================================================================
// listTasks
// =============================================================================

describe("listTasks", () => {
  beforeEach(() => seedStore());

  test("returns all tasks when no filters", async () => {
    const ctx = createTestContext();
    const result = await listTasks({}, ctx);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().length).toBe(5);
  });

  test("filters by status", async () => {
    const ctx = createTestContext();
    const result = await listTasks({ status: "pending" }, ctx);
    expect(result.isOk()).toBe(true);
    const tasks = result.unwrap();
    expect(tasks.length).toBe(3);
    for (const task of tasks) {
      expect(task.status).toBe("pending");
    }
  });

  test("filters by assignee", async () => {
    const ctx = createTestContext();
    const result = await listTasks({ assignee: "alice" }, ctx);
    expect(result.isOk()).toBe(true);
    const tasks = result.unwrap();
    expect(tasks.length).toBe(2);
    for (const task of tasks) {
      expect(task.assignee).toBe("alice");
    }
  });

  test("returns empty array for no matches", async () => {
    const ctx = createTestContext();
    const result = await listTasks({ assignee: "nobody" }, ctx);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().length).toBe(0);
  });

  test("applies limit when provided", async () => {
    const ctx = createTestContext();
    const result = await listTasks({ limit: 2 }, ctx);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().length).toBe(2);
  });

  test("applies offset and limit together", async () => {
    const ctx = createTestContext();
    const result = await listTasks({ offset: 2, limit: 2 }, ctx);
    expect(result.isOk()).toBe(true);
    const tasks = result.unwrap();
    expect(tasks.length).toBe(2);
    expect(tasks[0]?.id).toBe("3");
    expect(tasks[1]?.id).toBe("4");
  });
});

// =============================================================================
// createTask
// =============================================================================

describe("createTask", () => {
  beforeEach(() => resetStore());

  test("creates a task with valid input", async () => {
    const ctx = createTestContext();
    const result = await createTask({ title: "New task", tags: [] }, ctx);
    expect(result.isOk()).toBe(true);
    const task = result.unwrap();
    expect(task.title).toBe("New task");
    expect(task.status).toBe("pending");
    expect(task.id).toBeDefined();
  });

  test("creates a task with assignee and tags", async () => {
    const ctx = createTestContext();
    const result = await createTask(
      { title: "Tagged task", assignee: "alice", tags: ["urgent", "api"] },
      ctx
    );
    expect(result.isOk()).toBe(true);
    const task = result.unwrap();
    expect(task.assignee).toBe("alice");
    expect(task.tags).toEqual(["urgent", "api"]);
  });

  test("returns ValidationError for empty title", async () => {
    const ctx = createTestContext();
    const result = await createTask({ title: "", tags: [] }, ctx);
    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("validation");
  });
});

// =============================================================================
// updateTask
// =============================================================================

describe("updateTask", () => {
  beforeEach(() => seedStore());

  test("updates status of existing task", async () => {
    const ctx = createTestContext();
    const result = await updateTask({ id: "1", status: "in_progress" }, ctx);
    expect(result.isOk()).toBe(true);
    const task = result.unwrap();
    expect(task.status).toBe("in_progress");
    expect(task.id).toBe("1");
  });

  test("returns NotFoundError for unknown ID", async () => {
    const ctx = createTestContext();
    const result = await updateTask({ id: "999", status: "done" }, ctx);
    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("not_found");
  });
});

// =============================================================================
// deleteTask
// =============================================================================

describe("deleteTask", () => {
  beforeEach(() => seedStore());

  test("deletes existing task (live mode)", async () => {
    const ctx = createTestContext();
    const before = getAllTasks().length;
    const result = await deleteTask({ id: "1" }, ctx);
    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.dryRun).toBe(false);
    expect(data.deleted.id).toBe("1");
    expect(getAllTasks().length).toBe(before - 1);
  });

  test("dry-run does not delete the task (v0.6 safety)", async () => {
    const ctx = createTestContext();
    const before = getAllTasks().length;
    const result = await deleteTask({ id: "1", dryRun: true }, ctx);
    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.dryRun).toBe(true);
    expect(data.deleted.id).toBe("1");
    // Task still exists
    expect(getAllTasks().length).toBe(before);
  });

  test("returns NotFoundError for unknown ID", async () => {
    const ctx = createTestContext();
    const result = await deleteTask({ id: "999" }, ctx);
    expect(result.isErr()).toBe(true);
    expect(result.error.category).toBe("not_found");
  });
});

// =============================================================================
// analyzeTasks (streaming with ctx.progress)
// =============================================================================

describe("analyzeTasks", () => {
  beforeEach(() => seedStore());

  test("returns analysis without streaming", async () => {
    const ctx = createTestContext();
    const result = await analyzeTasks({ detailed: false }, ctx);
    expect(result.isOk()).toBe(true);
    const data = result.unwrap();
    expect(data.total).toBe(5);
    expect(data.byStatus).toBeDefined();
    expect(data.byAssignee).toBeDefined();
    expect(data.unassigned).toBeGreaterThanOrEqual(0);
  });

  test("emits progress events when streaming (v0.6)", async () => {
    const events: StreamEvent[] = [];
    const ctx = createTestContext({
      progress: (event: StreamEvent) => {
        events.push(event);
      },
    });

    const result = await analyzeTasks({ detailed: false }, ctx);
    expect(result.isOk()).toBe(true);

    // Verify start event
    expect(events[0]?.type).toBe("start");

    // Verify step events exist
    const steps = events.filter((e) => e.type === "step");
    expect(steps.length).toBeGreaterThanOrEqual(2);

    // Verify progress events exist (one per task)
    const progressEvents = events.filter((e) => e.type === "progress");
    expect(progressEvents.length).toBe(5); // 5 seeded tasks
  });

  test("progress events have correct ordering (v0.6)", async () => {
    const events: StreamEvent[] = [];
    const ctx = createTestContext({
      progress: (event: StreamEvent) => events.push(event),
    });

    await analyzeTasks({ detailed: false }, ctx);

    // Start event is first
    expect(events[0]?.type).toBe("start");

    // No events of unknown type
    for (const event of events) {
      expect(["start", "step", "progress"]).toContain(event.type);
    }
  });
});

// =============================================================================
// safeOperation (wrapError utility)
// =============================================================================

describe("safeOperation", () => {
  test("returns Ok for successful operations", () => {
    const result = safeOperation(() => 42);
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(42);
  });

  test("returns Err for throwing operations", () => {
    const result = safeOperation(() => {
      throw new Error("boom");
    });
    expect(result.isErr()).toBe(true);
  });
});

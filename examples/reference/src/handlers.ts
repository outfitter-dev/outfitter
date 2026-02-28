/**
 * Transport-agnostic handlers for the reference task tracker.
 *
 * Each handler is a pure function returning `Result<T, E>` — it knows nothing
 * about CLI flags, output format, or MCP transport. CLI and MCP are thin
 * adapters over these shared handlers.
 *
 * Demonstrates:
 * - Handler contract (v0.4)
 * - Result types from better-result
 * - Streaming with ctx.progress (v0.6)
 * - Error taxonomy (validation, not_found)
 * - Utility functions (parseInput, wrapError, expectOk)
 */

import type { HandlerContext, OutfitterError } from "@outfitter/contracts";
import {
  NotFoundError,
  parseInput,
  Result,
  ValidationError,
  wrapError,
} from "@outfitter/contracts";

import type {
  AnalyzeTasksInputType,
  CreateTaskInputType,
  DeleteTaskInputType,
  ListTasksInputType,
  Task,
  UpdateTaskInputType,
} from "./schemas.js";
import {
  CreateTaskInput,
  DeleteTaskInput,
  UpdateTaskInput,
} from "./schemas.js";

// =============================================================================
// In-Memory Store
// =============================================================================

/** Simple in-memory task store for demonstration purposes. */
const store: Map<string, Task> = new Map();
let nextId = 1;

/** Seed the store with sample data. */
export function seedStore(): void {
  store.clear();
  nextId = 1;
  const now = new Date().toISOString();
  const tasks: Task[] = [
    {
      id: "1",
      title: "Set up CI pipeline",
      status: "done",
      assignee: "alice",
      tags: ["infra"],
      createdAt: now,
    },
    {
      id: "2",
      title: "Write API docs",
      status: "in_progress",
      assignee: "bob",
      tags: ["docs"],
      createdAt: now,
    },
    {
      id: "3",
      title: "Add auth middleware",
      status: "pending",
      assignee: "alice",
      tags: ["security", "api"],
      createdAt: now,
    },
    {
      id: "4",
      title: "Fix date parsing bug",
      status: "pending",
      tags: ["bug"],
      createdAt: now,
    },
    {
      id: "5",
      title: "Deploy staging env",
      status: "pending",
      assignee: "carol",
      tags: ["infra", "ops"],
      createdAt: now,
    },
  ];
  for (const task of tasks) {
    store.set(task.id, task);
  }
  nextId = 6;
}

/** Reset the store (useful for testing). */
export function resetStore(): void {
  store.clear();
  nextId = 1;
}

/** Get all tasks from the store. */
export function getAllTasks(): Task[] {
  return [...store.values()];
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * List tasks with optional filters.
 *
 * Demonstrates: output mode patterns (v0.4), pagination support.
 */
export async function listTasks(
  input: ListTasksInputType,
  _ctx: HandlerContext
): Promise<Result<Task[], OutfitterError>> {
  let tasks = getAllTasks();

  // Apply filters
  if (input.status) {
    tasks = tasks.filter((t) => t.status === input.status);
  }
  if (input.assignee) {
    tasks = tasks.filter((t) => t.assignee === input.assignee);
  }

  // Apply pagination after filters so CLI and MCP surfaces behave consistently.
  const offset = Math.max(0, input.offset ?? 0);
  if (offset > 0) {
    tasks = tasks.slice(offset);
  }
  if (input.limit !== undefined) {
    tasks = tasks.slice(0, input.limit);
  }

  return Result.ok(tasks);
}

/**
 * Create a new task.
 *
 * Demonstrates: input validation with parseInput, Result composition.
 */
export async function createTask(
  input: CreateTaskInputType,
  _ctx: HandlerContext
): Promise<Result<Task, ValidationError>> {
  // Validate input using parseInput utility (Zod → Result)
  const validated = parseInput(CreateTaskInput, input);
  if (validated.isErr()) return validated;

  const id = String(nextId++);
  const data = validated.unwrap();
  const task: Task = {
    id,
    title: data.title,
    status: "pending",
    assignee: data.assignee,
    tags: data.tags,
    createdAt: new Date().toISOString(),
  };
  store.set(id, task);
  return Result.ok(task);
}

/**
 * Update a task's status.
 *
 * Demonstrates: error taxonomy with NotFoundError, wrapError utility.
 */
export async function updateTask(
  input: UpdateTaskInputType,
  _ctx: HandlerContext
): Promise<Result<Task, NotFoundError | ValidationError>> {
  const validated = parseInput(UpdateTaskInput, input);
  if (validated.isErr()) return validated;

  const data = validated.unwrap();
  const task = store.get(data.id);
  if (!task) {
    return Result.err(NotFoundError.create("task", data.id));
  }

  const updated: Task = { ...task, status: data.status };
  store.set(updated.id, updated);
  return Result.ok(updated);
}

/**
 * Delete a task (destructive operation).
 *
 * Demonstrates: destructive command with --dry-run support (v0.6).
 * When dryRun is true, the handler returns preview info without deleting.
 */
export async function deleteTask(
  input: DeleteTaskInputType & { dryRun?: boolean },
  _ctx: HandlerContext
): Promise<
  Result<{ deleted: Task; dryRun: boolean }, NotFoundError | ValidationError>
> {
  const validated = parseInput(DeleteTaskInput, input);
  if (validated.isErr()) return validated;

  const data = validated.unwrap();
  const task = store.get(data.id);
  if (!task) {
    return Result.err(NotFoundError.create("task", data.id));
  }

  const isDryRun = input.dryRun === true;
  if (!isDryRun) {
    store.delete(data.id);
  }
  return Result.ok({ deleted: task, dryRun: isDryRun });
}

/** Analysis result shape. */
interface AnalysisResult {
  total: number;
  byStatus: Record<string, number>;
  byAssignee: Record<string, number>;
  unassigned: number;
}

/**
 * Analyze tasks with streaming progress.
 *
 * Demonstrates: ctx.progress for streaming (v0.6), step/progress events.
 */
export async function analyzeTasks(
  _input: AnalyzeTasksInputType,
  ctx: HandlerContext
): Promise<Result<AnalysisResult, OutfitterError>> {
  const tasks = getAllTasks();

  // Emit start event if streaming
  ctx.progress?.({
    type: "start",
    command: "task analyze",
    ts: new Date().toISOString(),
  });

  // Step 1: Count by status
  ctx.progress?.({
    type: "step",
    name: "counting by status",
    status: "running",
  });
  const byStatus: Record<string, number> = {};
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
  }
  ctx.progress?.({
    type: "step",
    name: "counting by status",
    status: "complete",
    duration_ms: 5,
  });

  // Step 2: Count by assignee (with progress events)
  ctx.progress?.({
    type: "step",
    name: "counting by assignee",
    status: "running",
  });
  const byAssignee: Record<string, number> = {};
  let unassigned = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    if (task.assignee) {
      byAssignee[task.assignee] = (byAssignee[task.assignee] ?? 0) + 1;
    } else {
      unassigned++;
    }

    // Emit incremental progress
    ctx.progress?.({
      type: "progress",
      current: i + 1,
      total: tasks.length,
      message: `Analyzed task ${i + 1} of ${tasks.length}`,
    });
  }
  ctx.progress?.({
    type: "step",
    name: "counting by assignee",
    status: "complete",
    duration_ms: 10,
  });

  return Result.ok({
    total: tasks.length,
    byStatus,
    byAssignee,
    unassigned,
  });
}

/**
 * Demonstrate wrapError for normalizing unknown errors.
 *
 * This helper wraps any unexpected error into an InternalError.
 */
export function safeOperation<T>(fn: () => T): Result<T, OutfitterError> {
  try {
    return Result.ok(fn());
  } catch (err: unknown) {
    const wrapped = wrapError(err);
    return Result.err(wrapped);
  }
}

/**
 * Shared Zod schemas for the reference project.
 *
 * Schemas define the validated input/output shapes used by both CLI
 * and MCP surfaces. The same schema feeds `.input()` on CommandBuilder
 * and `inputSchema` on defineTool().
 */

import { z } from "zod";

// =============================================================================
// Task Domain Schemas
// =============================================================================

/**
 * Task status enum shared across all surfaces.
 */
export const TaskStatus = z.enum(["pending", "in_progress", "done"]);

/**
 * A single task in the task tracker.
 */
export const TaskSchema = z.object({
  id: z.string().describe("Unique task identifier"),
  title: z.string().min(1).describe("Task title"),
  status: TaskStatus.default("pending").describe("Current task status"),
  assignee: z.string().optional().describe("Assigned user"),
  tags: z.array(z.string()).default([]).describe("Task tags"),
  createdAt: z.string().describe("ISO-8601 creation timestamp"),
});

export type Task = z.infer<typeof TaskSchema>;

// =============================================================================
// Handler Input Schemas
// =============================================================================

/**
 * Input for listing tasks with optional filters.
 */
export const ListTasksInput = z.object({
  status: TaskStatus.optional().describe("Filter by status"),
  assignee: z.string().optional().describe("Filter by assignee"),
  limit: z.coerce.number().int().positive().optional().describe("Max results"),
  offset: z.coerce.number().int().min(0).optional().describe("Starting offset"),
});

export type ListTasksInputType = z.infer<typeof ListTasksInput>;

/**
 * Input for creating a new task.
 */
export const CreateTaskInput = z.object({
  title: z.string().min(1).describe("Task title"),
  assignee: z.string().optional().describe("Assigned user"),
  tags: z.array(z.string()).default([]).describe("Task tags"),
});

export type CreateTaskInputType = z.infer<typeof CreateTaskInput>;

/**
 * Input for updating a task's status.
 */
export const UpdateTaskInput = z.object({
  id: z.string().min(1).describe("Task ID"),
  status: TaskStatus.describe("New status"),
});

export type UpdateTaskInputType = z.infer<typeof UpdateTaskInput>;

/**
 * Input for deleting a task (destructive operation).
 */
export const DeleteTaskInput = z.object({
  id: z.string().min(1).describe("Task ID to delete"),
});

export type DeleteTaskInputType = z.infer<typeof DeleteTaskInput>;

/**
 * Input for analyzing tasks (streaming operation).
 */
export const AnalyzeTasksInput = z.object({});

export type AnalyzeTasksInputType = z.infer<typeof AnalyzeTasksInput>;

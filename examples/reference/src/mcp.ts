/**
 * MCP server adapter for the reference task tracker.
 *
 * Demonstrates:
 * - defineTool() with Zod schema validation
 * - defineResource() for static resource exposure
 * - Shared handlers between CLI and MCP surfaces
 * - readOnly/idempotent tool annotations mapping to MCP hints (v0.6)
 * - Streaming via ctx.progress → notifications/progress (v0.6)
 *
 * The same handler functions used by the CLI adapter are reused here —
 * handlers know nothing about transport.
 */

import { Result } from "@outfitter/contracts";
import { createMcpServer, defineResource, defineTool } from "@outfitter/mcp";

import {
  analyzeTasks,
  createTask,
  deleteTask,
  listTasks,
  seedStore,
  updateTask,
} from "./handlers.js";
import {
  AnalyzeTasksInput,
  CreateTaskInput,
  DeleteTaskInput,
  ListTasksInput,
  UpdateTaskInput,
} from "./schemas.js";

// =============================================================================
// Tool Definitions
// =============================================================================

/**
 * MCP tool: List tasks.
 *
 * readOnly and idempotent annotations inform agents this tool is safe to call
 * repeatedly without side effects.
 */
export const listTasksTool = defineTool({
  name: "task_list",
  description: "List tasks with optional status and assignee filters",
  inputSchema: ListTasksInput,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
  },
  handler: listTasks,
});

/**
 * MCP tool: Create a task.
 *
 * Not idempotent — each call creates a new task.
 */
export const createTaskTool = defineTool({
  name: "task_create",
  description: "Create a new task with title, optional assignee, and tags",
  inputSchema: CreateTaskInput,
  handler: createTask,
});

/**
 * MCP tool: Update a task.
 *
 * Idempotent — updating to the same status multiple times is safe.
 */
export const updateTaskTool = defineTool({
  name: "task_update",
  description: "Update a task's status by ID",
  inputSchema: UpdateTaskInput,
  annotations: {
    idempotentHint: true,
  },
  handler: updateTask,
});

/**
 * MCP tool: Delete a task.
 *
 * Destructive — not safe to retry blindly.
 */
export const deleteTaskTool = defineTool({
  name: "task_delete",
  description: "Delete a task by ID (destructive)",
  inputSchema: DeleteTaskInput,
  annotations: {
    destructiveHint: true,
  },
  handler: deleteTask,
});

/**
 * MCP tool: Analyze tasks with streaming progress.
 *
 * When the MCP client provides a progressToken, the handler's ctx.progress
 * calls are translated to MCP notifications/progress events.
 */
export const analyzeTasksTool = defineTool({
  name: "task_analyze",
  description: "Analyze task statistics with optional streaming progress",
  inputSchema: AnalyzeTasksInput,
  annotations: {
    readOnlyHint: true,
  },
  handler: analyzeTasks,
});

// =============================================================================
// Resource Definitions
// =============================================================================

/**
 * Static MCP resource: task schema documentation.
 *
 * Demonstrates defineResource() for exposing structured information to agents.
 */
export const taskSchemaResource = defineResource({
  uri: "reference://schema/tasks",
  name: "Task Schema",
  description: "JSON schema describing the Task data model",
  mimeType: "application/json",
  handler: async (uri) =>
    Result.ok([
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            type: "object",
            title: "Task",
            properties: {
              id: { type: "string", description: "Unique task identifier" },
              title: { type: "string", description: "Task title" },
              status: {
                type: "string",
                enum: ["pending", "in_progress", "done"],
                description: "Current task status",
              },
              assignee: {
                type: "string",
                description: "Assigned user",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Task tags",
              },
              createdAt: {
                type: "string",
                description: "ISO-8601 creation timestamp",
              },
            },
            required: ["id", "title", "status", "tags", "createdAt"],
          },
          null,
          2
        ),
      },
    ]),
});

// =============================================================================
// Server Assembly
// =============================================================================

/**
 * Build the MCP server with all tools and resources registered.
 *
 * Reuses the exact same handler functions as the CLI — the MCP server
 * is just a different transport adapter over shared logic.
 */
export function buildMcpServer() {
  const server = createMcpServer({
    name: "reference-task-tracker",
    version: "0.1.0",
  });

  // Register tools (same handlers as CLI)
  server.registerTool(listTasksTool);
  server.registerTool(createTaskTool);
  server.registerTool(updateTaskTool);
  server.registerTool(deleteTaskTool);
  server.registerTool(analyzeTasksTool);

  // Register static resource
  server.registerResource(taskSchemaResource);

  return server;
}

/**
 * Start the MCP server on stdio transport.
 */
export async function main(): Promise<void> {
  seedStore();
  buildMcpServer();
  // In a real project: capture the return value and call connectStdio(server)
}

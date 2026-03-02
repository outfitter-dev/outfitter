/**
 * Tests for the MCP server adapter.
 *
 * Verifies: defineTool/defineResource usage, tool annotations mapping,
 * shared handler integration between CLI and MCP surfaces.
 */

import { describe, expect, test, beforeEach } from "bun:test";

import { seedStore } from "../handlers.js";
import {
  analyzeTasksTool,
  buildMcpServer,
  createTaskTool,
  deleteTaskTool,
  listTasksTool,
  taskSchemaResource,
  updateTaskTool,
} from "../mcp.js";

// =============================================================================
// Tool Definitions
// =============================================================================

describe("MCP tool definitions", () => {
  test("listTasksTool has correct name and annotations", () => {
    expect(listTasksTool.name).toBe("task_list");
    expect(listTasksTool.annotations?.readOnlyHint).toBe(true);
    expect(listTasksTool.annotations?.idempotentHint).toBe(true);
  });

  test("createTaskTool has correct name without safety annotations", () => {
    expect(createTaskTool.name).toBe("task_create");
    expect(createTaskTool.annotations).toBeUndefined();
  });

  test("updateTaskTool has idempotent annotation", () => {
    expect(updateTaskTool.name).toBe("task_update");
    expect(updateTaskTool.annotations?.idempotentHint).toBe(true);
  });

  test("deleteTaskTool has destructive annotation", () => {
    expect(deleteTaskTool.name).toBe("task_delete");
    expect(deleteTaskTool.annotations?.destructiveHint).toBe(true);
  });

  test("analyzeTasksTool has readOnly annotation", () => {
    expect(analyzeTasksTool.name).toBe("task_analyze");
    expect(analyzeTasksTool.annotations?.readOnlyHint).toBe(true);
  });
});

// =============================================================================
// Resource Definitions
// =============================================================================

describe("MCP resource definitions", () => {
  test("taskSchemaResource has correct URI and metadata", () => {
    expect(taskSchemaResource.uri).toBe("reference://schema/tasks");
    expect(taskSchemaResource.name).toBe("Task Schema");
    expect(taskSchemaResource.mimeType).toBe("application/json");
  });
});

// =============================================================================
// Server Assembly
// =============================================================================

describe("MCP server assembly", () => {
  beforeEach(() => seedStore());

  test("builds server with all tools registered", () => {
    const server = buildMcpServer();
    expect(server).toBeDefined();
    // Server exposes getTools() for serialization
    const tools = server.getTools();
    expect(tools.length).toBe(5);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("task_list");
    expect(toolNames).toContain("task_create");
    expect(toolNames).toContain("task_update");
    expect(toolNames).toContain("task_delete");
    expect(toolNames).toContain("task_analyze");
  });

  test("tool annotations are preserved in serialized tools", () => {
    const server = buildMcpServer();
    const tools = server.getTools();

    const listTool = tools.find((t) => t.name === "task_list");
    expect(listTool?.annotations?.readOnlyHint).toBe(true);
    expect(listTool?.annotations?.idempotentHint).toBe(true);

    const deleteTool = tools.find((t) => t.name === "task_delete");
    expect(deleteTool?.annotations?.destructiveHint).toBe(true);
  });

  test("task_list tool honors limit/offset across MCP surface", async () => {
    const server = buildMcpServer();
    const result = await server.invokeTool("task_list", {
      limit: 1,
      offset: 1,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const tasks = result.value as Array<{ id: string }>;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.id).toBe("2");
  });

  test("task schema resource is readable", async () => {
    const server = buildMcpServer();
    const result = await server.readResource("reference://schema/tasks");

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(result.value).toHaveLength(1);
    const content = result.value[0] as { text?: string };
    expect(content.text).toBeDefined();
    const parsed = JSON.parse(content.text ?? "{}") as { type?: string };
    expect(parsed.type).toBe("object");
  });
});

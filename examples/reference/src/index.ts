/**
 * @outfitter/reference — Standalone reference project
 *
 * Demonstrates v0.4-v0.6 Outfitter integration with a task tracker:
 *
 * - **v0.4**: Output mode patterns (human, json, jsonl)
 * - **v0.5**: Builder pattern (.input/.context/.hints/.onError),
 *            response envelope with runHandler(), expectOk utility
 * - **v0.6**: Streaming with ctx.progress, safety primitives
 *            (.destructive, readOnly, idempotent), context protection
 *            (truncation, pagination hints, file pointers),
 *            .relatedTo() action graph (tier-4 hints)
 *
 * All domain logic lives in handlers.ts — pure functions returning
 * Result<T, E>. CLI (cli.ts) and MCP (mcp.ts) are thin adapters
 * over the same handlers.
 *
 * @packageDocumentation
 */

export { buildCLI, main as cliMain } from "./cli.js";
export {
  analyzeTasks,
  createTask,
  deleteTask,
  getAllTasks,
  listTasks,
  resetStore,
  safeOperation,
  seedStore,
  updateTask,
} from "./handlers.js";
export {
  analyzeTasksTool,
  buildMcpServer,
  createTaskTool,
  deleteTaskTool,
  listTasksTool,
  main as mcpMain,
  taskSchemaResource,
  updateTaskTool,
} from "./mcp.js";
export {
  AnalyzeTasksInput,
  CreateTaskInput,
  DeleteTaskInput,
  ListTasksInput,
  type Task,
  TaskSchema,
  TaskStatus,
  UpdateTaskInput,
} from "./schemas.js";

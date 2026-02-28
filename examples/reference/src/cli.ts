/**
 * CLI adapter for the reference task tracker.
 *
 * Demonstrates the full CLI builder pattern from v0.4-v0.6:
 *
 * - **v0.4**: Output mode patterns via outputModePreset, resolveOutputMode
 * - **v0.5**: Builder pattern with .input()/.context()/.hints()/.onError(),
 *            response envelope with runHandler()
 * - **v0.6**: Streaming with --stream and ctx.progress,
 *            safety primitives — .destructive() with --dry-run,
 *            readOnly/idempotent metadata,
 *            context protection with truncation,
 *            .relatedTo() action graph (tier-4 hints),
 *            flag presets
 */

import { command, createCLI } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import {
  outputModePreset,
  resolveOutputMode,
  streamPreset,
} from "@outfitter/cli/query";
import { truncateOutput } from "@outfitter/cli/truncation";
import type { CLIHint, HandlerContext } from "@outfitter/contracts";
import { Result } from "@outfitter/contracts";

import {
  analyzeTasks,
  createTask,
  deleteTask,
  listTasks,
  seedStore,
  updateTask,
} from "./handlers.js";
import type { ListTasksInputType, Task } from "./schemas.js";
import {
  AnalyzeTasksInput,
  CreateTaskInput,
  DeleteTaskInput,
  ListTasksInput,
  UpdateTaskInput,
} from "./schemas.js";

// =============================================================================
// CLI Setup
// =============================================================================

/**
 * Build the reference CLI application.
 *
 * This function creates and returns the CLI instance without parsing —
 * making it testable without invoking process.argv.
 */
export function buildCLI() {
  const cli = createCLI({
    name: "task",
    version: "0.1.0",
    description: "Reference task tracker demonstrating Outfitter v0.4-v0.6",
  });

  // ─── list ─────────────────────────────────────────────────────────────
  // Demonstrates: output mode (v0.4), .input() schema (v0.5), truncation (v0.6),
  //               readOnly metadata (v0.6), .relatedTo() (v0.6), flag presets
  const listCmd = command("list")
    .description("List tasks with optional filters")
    .input(ListTasksInput)
    .preset(outputModePreset({ modes: ["human", "json", "jsonl"] }))
    .preset(streamPreset())
    .readOnly(true)
    .idempotent(true)
    .relatedTo("create", { description: "Create a new task" })
    .relatedTo("analyze", { description: "Analyze task statistics" })
    .hints((_result, _input) => {
      const hints: CLIHint[] = [
        {
          description: "Create a new task",
          command: "task create --title 'New task'",
        },
      ];
      return hints;
    })
    .action(async ({ input, flags }) => {
      const typedFlags = flags as Record<string, unknown>;
      const { mode } = resolveOutputMode(typedFlags);
      const isStreaming = typedFlags["stream"] === true;

      await runHandler({
        command: "task list",
        handler: async (inp: ListTasksInputType, ctx: HandlerContext) => {
          const result = await listTasks(inp, ctx);
          if (result.isErr()) return result;

          const tasks = result.unwrap();

          // Apply truncation when limit is configured (v0.6 context protection)
          if (inp.limit !== undefined) {
            const truncationOpts = {
              limit: inp.limit,
              commandName: "task list",
              ...(inp.offset !== undefined ? { offset: inp.offset } : {}),
            };
            const truncated = truncateOutput<Task>(tasks, truncationOpts);

            if (truncated.metadata) {
              // Cast to satisfy runHandler's generic — the envelope will
              // serialize the enriched shape including _truncation metadata
              return Result.ok({
                items: truncated.data,
                _truncation: truncated.metadata,
              }) as unknown as typeof result;
            }
          }

          return result;
        },
        input: input ?? {},
        format: mode,
        stream: isStreaming,
      });
    })
    .build();

  // ─── create ───────────────────────────────────────────────────────────
  // Demonstrates: .input() with Zod schema (v0.5), .context() factory (v0.5),
  //               runHandler with envelope
  const createCmd = command("create")
    .description("Create a new task")
    .input(CreateTaskInput)
    .context(async (input) => {
      // Context factory: derive computed data from validated input.
      // Normalizes tags to lowercase and prepares a creation timestamp
      // so the handler receives ready-to-use, pre-processed values.
      const normalizedTags = input.tags.map((t: string) => t.toLowerCase());
      return {
        normalizedTags,
        createdAt: new Date().toISOString(),
      };
    })
    .preset(outputModePreset())
    .relatedTo("list", { description: "List all tasks" })
    .relatedTo("update", { description: "Update task status" })
    .hints((result, _input) => {
      const task = result as { id: string };
      return [
        {
          description: "View the created task",
          command: "task list --status pending",
        },
        {
          description: "Update its status",
          command: `task update --id ${task.id} --status in_progress`,
        },
      ];
    })
    .action(async ({ input, flags, ctx }) => {
      const { mode } = resolveOutputMode(flags as Record<string, unknown>);
      // Use context-derived normalizedTags for the handler input
      const enrichedInput = {
        ...(input ?? { title: "", tags: [] }),
        tags: ctx?.normalizedTags ?? input?.tags ?? [],
      };
      await runHandler({
        command: "task create",
        handler: createTask,
        input: enrichedInput,
        format: mode,
      });
    })
    .build();

  // ─── update ───────────────────────────────────────────────────────────
  // Demonstrates: .idempotent() metadata (v0.6), error hints with .onError()
  const updateCmd = command("update")
    .description("Update a task status")
    .input(UpdateTaskInput)
    .preset(outputModePreset())
    .idempotent(true)
    .relatedTo("list", { description: "List tasks to find IDs" })
    .relatedTo("delete", { description: "Delete a task" })
    .onError((_error, _input) => [
      {
        description: "List tasks to find valid IDs",
        command: "task list --output json",
      },
    ])
    .action(async ({ input, flags }) => {
      const { mode } = resolveOutputMode(flags as Record<string, unknown>);
      await runHandler({
        command: "task update",
        handler: updateTask,
        input: input ?? { id: "", status: "pending" as const },
        format: mode,
      });
    })
    .build();

  // ─── delete ───────────────────────────────────────────────────────────
  // Demonstrates: .destructive(true) with auto --dry-run (v0.6 safety)
  const deleteCmd = command("delete")
    .description("Delete a task (destructive)")
    .input(DeleteTaskInput)
    .preset(outputModePreset())
    .destructive(true)
    .relatedTo("list", { description: "List tasks first" })
    .onError((_error, _input) => [
      {
        description: "List tasks to find valid IDs",
        command: "task list --output json",
      },
    ])
    .action(async ({ input, flags }) => {
      const typedFlags = flags as Record<string, unknown>;
      const { mode } = resolveOutputMode(typedFlags);
      const isDryRun = typedFlags["dryRun"] === true;

      await runHandler({
        command: "task delete",
        handler: deleteTask,
        input: { ...(input ?? { id: "" }), dryRun: isDryRun },
        format: mode,
        dryRun: isDryRun,
      });
    })
    .build();

  // ─── analyze ──────────────────────────────────────────────────────────
  // Demonstrates: streaming with ctx.progress (v0.6), --stream flag
  const analyzeCmd = command("analyze")
    .description("Analyze task statistics with streaming progress")
    .input(AnalyzeTasksInput)
    .preset(outputModePreset())
    .preset(streamPreset())
    .readOnly(true)
    .relatedTo("list", { description: "View individual tasks" })
    .action(async ({ input, flags }) => {
      const typedFlags = flags as Record<string, unknown>;
      const { mode } = resolveOutputMode(typedFlags);
      const isStreaming = typedFlags["stream"] === true;

      await runHandler({
        command: "task analyze",
        handler: analyzeTasks,
        input: input ?? { detailed: false },
        format: mode,
        stream: isStreaming,
      });
    })
    .build();

  // Register all commands
  cli.register(listCmd);
  cli.register(createCmd);
  cli.register(updateCmd);
  cli.register(deleteCmd);
  cli.register(analyzeCmd);

  return cli;
}

/**
 * Main entry point — parse argv and execute.
 *
 * Seed the store with sample data before parsing to ensure the demo
 * has data to work with.
 */
export async function main(): Promise<void> {
  seedStore();
  const cli = buildCLI();
  await cli.parse();
}

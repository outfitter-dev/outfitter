/**
 * {{projectName}} - CLI program definition
 *
 * Demonstrates the v0.5 builder pattern:
 * - `.input(schema)` for Zod-to-Commander auto-derived flags
 * - `runHandler()` for the full lifecycle bridge
 * - `contextFactory` + `hints` passed in one canonical place
 */

import { command, createCLI } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import type { CLIHint } from "@outfitter/contracts";
import { NotFoundError, Result } from "@outfitter/contracts";
import { createLogger } from "@outfitter/logging";
import { z } from "zod";

const logger = createLogger({ name: "{{binName}}" });

// =============================================================================
// Domain Types
// =============================================================================

interface Todo {
  readonly id: number;
  readonly title: string;
  readonly done: boolean;
}

/** In-memory store (replace with file/DB in a real app). */
const store: Todo[] = [];
let nextId = 1;

// =============================================================================
// Context
// =============================================================================

/**
 * Shared context constructed once per command invocation.
 * The `.context()` builder method calls this factory with the validated input.
 */
interface TodoContext {
  readonly count: number;
  readonly pendingCount: number;
}

async function buildTodoContext(): Promise<TodoContext> {
  return {
    count: store.length,
    pendingCount: store.filter((t) => !t.done).length,
  };
}

// =============================================================================
// Schemas
// =============================================================================

const addInputSchema = z.object({
  title: z.string().describe("Title of the todo item"),
});

const completeInputSchema = z.object({
  id: z.number().describe("ID of the todo to complete"),
});

const listInputSchema = z.object({
  all: z.boolean().default(false).describe("Show completed todos too"),
});

// =============================================================================
// Hint Functions
// =============================================================================

function addHints(
  _result: unknown,
  _input: z.infer<typeof addInputSchema>
): CLIHint[] {
  return [
    { description: "List your todos", command: "{{binName}} list" },
    {
      description: "Add another todo",
      command: `{{binName}} add --title "next task"`,
    },
  ];
}

function completeHints(
  _result: unknown,
  _input: z.infer<typeof completeInputSchema>
): CLIHint[] {
  return [
    { description: "List remaining todos", command: "{{binName}} list" },
    {
      description: "Show all including completed",
      command: "{{binName}} list --all",
    },
  ];
}

// =============================================================================
// CLI Program
// =============================================================================

export const program = createCLI({
  name: "{{binName}}",
  version: "{{version}}",
  description: "{{description}}",
});

/**
 * `add` — Create a new todo item.
 *
 * Uses `.input()` to auto-derive `--title` from the Zod schema and
 * `runHandler()` to provide context + hints in one place.
 */
program.register(
  command("add")
    .description("Add a new todo item")
    .input(addInputSchema)
    .action(async ({ input }) => {
      await runHandler({
        command: "add",
        input,
        format: "json",
        contextFactory: buildTodoContext,
        hints: addHints,
        handler: async (inp, context) => {
          const todo: Todo = { id: nextId++, title: inp.title, done: false };
          store.push(todo);
          logger.info(`Added todo #${todo.id}: ${todo.title}`);
          return Result.ok({
            id: todo.id,
            title: todo.title,
            pending: context.pendingCount + 1,
          });
        },
      });
    })
);

/**
 * `list` — Show current todo items.
 *
 * Uses `.input()` with a boolean flag auto-derived from the schema.
 */
program.register(
  command("list")
    .description("List todo items")
    .input(listInputSchema)
    .action(async ({ input }) => {
      await runHandler({
        command: "list",
        input,
        format: "json",
        contextFactory: buildTodoContext,
        handler: async (inp, context) => {
          const items = inp.all ? store : store.filter((t) => !t.done);
          return Result.ok({
            items: items.map((t) => ({
              id: t.id,
              title: t.title,
              done: t.done,
            })),
            total: context.count,
            pending: context.pendingCount,
          });
        },
      });
    })
);

/**
 * `complete` — Mark a todo as done.
 *
 * Uses `.input()` with a number flag and delegates hints/error handling
 * through `runHandler()`.
 */
program.register(
  command("complete")
    .description("Mark a todo as completed")
    .input(completeInputSchema)
    .action(async ({ input }) => {
      await runHandler({
        command: "complete",
        input,
        format: "json",
        contextFactory: buildTodoContext,
        hints: completeHints,
        onError: () => [
          { description: "List available todos", command: "{{binName}} list" },
        ],
        handler: async (inp) => {
          const index = store.findIndex((t) => t.id === inp.id);
          if (index === -1) {
            return Result.err(NotFoundError.create("todo", String(inp.id)));
          }
          const todo = store[index];
          if (!todo) {
            return Result.err(NotFoundError.create("todo", String(inp.id)));
          }
          const completed = { ...todo, done: true as const };
          store[index] = completed;
          logger.info(`Completed todo #${completed.id}: ${completed.title}`);
          return Result.ok({
            id: completed.id,
            title: completed.title,
            done: true,
          });
        },
      });
    })
);

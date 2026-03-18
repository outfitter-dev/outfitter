#!/usr/bin/env bun
/**
 * {{projectName}} CLI entry point
 *
 * Wires CLI commands from the shared action registry.
 * Each command delegates to the core handler via `runHandler()`.
 */

import { createCLI, command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { createContext } from "@outfitter/contracts";
import {
  addAction,
  listAction,
  completeAction,
  deleteAction,
} from "{{packageName}}-core";

const program = createCLI({
  name: "{{binName}}",
  version: "{{version}}",
  description: "{{description}}",
});

// =============================================================================
// add
// =============================================================================

program.register(
  command(addAction.cli?.command ?? "add")
    .description(addAction.cli?.description ?? addAction.description ?? "")
    .option("--title <title>", "Title of the todo item")
    .action(async ({ flags }) => {
      const input = addAction.cli?.mapInput?.({ args: [], flags }) ?? {
        title: String(flags["title"] ?? ""),
      };

      await runHandler({
        command: "add",
        input,
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: async (handlerInput, ctx) =>
          addAction.handler(handlerInput, ctx),
        hints: () => [
          { description: "List your todos", command: "{{binName}} list" },
          {
            description: "Add another todo",
            command: `{{binName}} add --title "next task"`,
          },
        ],
      });
    })
);

// =============================================================================
// list
// =============================================================================

program.register(
  command(listAction.cli?.command ?? "list")
    .description(listAction.cli?.description ?? listAction.description ?? "")
    .option("--all", "Show completed todos too")
    .readOnly(true)
    .action(async ({ flags }) => {
      const input = listAction.cli?.mapInput?.({ args: [], flags }) ?? {
        all: Boolean(flags["all"]),
      };

      await runHandler({
        command: "list",
        input,
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: async (handlerInput, ctx) =>
          listAction.handler(handlerInput, ctx),
      });
    })
);

// =============================================================================
// complete
// =============================================================================

program.register(
  command(completeAction.cli?.command ?? "complete")
    .description(
      completeAction.cli?.description ?? completeAction.description ?? ""
    )
    .option("--id <id>", "ID of the todo to complete")
    .action(async ({ flags }) => {
      const input = completeAction.cli?.mapInput?.({ args: [], flags }) ?? {
        id: Number(flags["id"]),
      };

      await runHandler({
        command: "complete",
        input,
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: async (handlerInput, ctx) =>
          completeAction.handler(handlerInput, ctx),
        hints: () => [
          { description: "List remaining todos", command: "{{binName}} list" },
        ],
        onError: () => [
          { description: "List available todos", command: "{{binName}} list" },
        ],
      });
    })
);

// =============================================================================
// delete
// =============================================================================

program.register(
  command(deleteAction.cli?.command ?? "delete")
    .description(
      deleteAction.cli?.description ?? deleteAction.description ?? ""
    )
    .option("--id <id>", "ID of the todo to delete")
    .destructive(true)
    .action(async ({ flags }) => {
      const input = deleteAction.cli?.mapInput?.({ args: [], flags }) ?? {
        id: Number(flags["id"]),
      };

      await runHandler({
        command: "delete",
        input,
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: async (handlerInput, ctx) =>
          deleteAction.handler(handlerInput, ctx),
        onError: () => [
          { description: "List available todos", command: "{{binName}} list" },
        ],
      });
    })
);

program.parse(process.argv);

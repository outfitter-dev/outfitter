#!/usr/bin/env bun
/**
 * {{projectName}} CLI entry point
 *
 * Wires CLI commands from the shared action registry.
 */

import { createCLI, command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { createContext } from "@outfitter/contracts";
import { findAction, greetAction } from "{{packageName}}-core";

const program = createCLI({
  name: "{{projectName}}",
  version: "{{version}}",
  description: "{{description}}",
});

// Wire CLI commands from action definitions
program.register(
  command(greetAction.cli?.command ?? "greet [name]")
    .description(greetAction.cli?.description ?? greetAction.description ?? "")
    // Option is hardcoded rather than derived from greetAction.cli.options
    // to keep the template simple — real projects should use .input() with Zod.
    .option("--excited", "Add excitement to the greeting")
    .action(async ({ args, flags }) => {
      const input = greetAction.cli?.mapInput?.({
        args,
        flags,
      }) ?? { name: args[0] ?? "World", excited: Boolean(flags["excited"]) };

      await runHandler({
        command: "greet",
        input,
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: async (handlerInput, ctx) =>
          greetAction.handler(handlerInput, ctx),
        onError: () => [
          { description: "Show help", command: "{{projectName}} greet --help" },
        ],
      });
    })
);

program.register(
  command(findAction.cli?.command ?? "find <id>")
    .description(findAction.cli?.description ?? findAction.description ?? "")
    .action(async ({ args }) => {
      const input = findAction.cli?.mapInput?.({
        args,
        flags: {},
      }) ?? { id: args[0] ?? "" };

      await runHandler({
        command: "find",
        input,
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: async (handlerInput, ctx) =>
          findAction.handler(handlerInput, ctx),
        onError: (error) => [
          { description: "Show help", command: "{{projectName}} find --help" },
          ...(error.name === "NotFoundError"
            ? [
                {
                  description: "Try a different ID",
                  command: "{{projectName}} find <id>",
                },
              ]
            : []),
        ],
      });
    })
);

program.parse(process.argv);

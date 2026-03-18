#!/usr/bin/env bun
/**
 * {{projectName}} CLI entry point
 *
 * Wires CLI commands from the shared action registry.
 */

import { createCLI, command } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { createContext } from "@outfitter/contracts";
import { greetAction } from "{{packageName}}-core";

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
    .action(async ({ args }) => {
      const input = greetAction.cli?.mapInput?.({
        args,
        flags: { excited: process.argv.includes("--excited") },
      }) ?? { name: args[0] ?? "World", excited: false };

      await runHandler({
        command: "greet",
        input,
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: async (handlerInput, ctx) =>
          greetAction.handler(handlerInput, ctx),
      });
    })
);

program.parse(process.argv);

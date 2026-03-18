/**
 * {{projectName}} - CLI program definition
 */

import { command, createCLI } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { createContext } from "@outfitter/contracts";

import { greet, lookup } from "./commands/hello.js";

export const program = createCLI({
  name: "{{binName}}",
  version: "{{version}}",
  description: "{{description}}",
});

program.register(
  command("hello [name]")
    .description("Say hello")
    .action(async ({ args }) => {
      await runHandler({
        command: "hello",
        input: { name: args[0] ?? "World" },
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: greet,
        onError: () => [
          {
            description: "Show usage",
            command: "{{binName}} hello --help",
          },
        ],
      });
    })
);

program.register(
  command("lookup <id>")
    .description("Look up an item by ID")
    .action(async ({ args }) => {
      await runHandler({
        command: "lookup",
        input: { id: args[0] ?? "" },
        contextFactory: () =>
          createContext({ cwd: process.cwd(), env: process.env }),
        handler: lookup,
        onError: (error) => [
          {
            description: "List available items",
            command: "{{binName}} hello --help",
          },
          ...(error.name === "NotFoundError"
            ? [
                {
                  description: "Try a different ID",
                  command: "{{binName}} lookup <id>",
                },
              ]
            : []),
        ],
      });
    })
);

/**
 * {{projectName}} - CLI program definition
 */

import { command, createCLI } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { createContext } from "@outfitter/contracts";

import { greet } from "./commands/hello.js";

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

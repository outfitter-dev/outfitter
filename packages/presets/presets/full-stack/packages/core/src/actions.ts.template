/**
 * {{projectName}} action registry.
 *
 * Actions are the canonical unit of CLI and MCP functionality.
 * Define once, expose on both surfaces.
 *
 * @packageDocumentation
 */

import {
  type ActionRegistry,
  createActionRegistry,
  defineAction,
  type ValidationError,
} from "@outfitter/contracts";

import { createGreeting } from "./handlers.js";
import { greetingInputSchema, type Greeting } from "./types.js";

export const greetAction = defineAction<unknown, Greeting, ValidationError>({
  id: "greet",
  description: "Generate a greeting",
  surfaces: ["cli", "mcp"],
  input: greetingInputSchema,
  cli: {
    command: "greet [name]",
    description: "Generate a greeting",
    options: [
      {
        flags: "--excited",
        description: "Add excitement",
        defaultValue: false,
      },
    ],
    mapInput: ({ args, flags }) => ({
      name: args[0] ?? "World",
      excited: Boolean(flags["excited"]),
    }),
  },
  mcp: {
    tool: "greet",
    description: "Generate greeting via shared core handler",
    readOnly: true,
  },
  handler: createGreeting,
});

export function createRegistry(): ActionRegistry {
  const registry = createActionRegistry();
  registry.add(greetAction);
  return registry;
}

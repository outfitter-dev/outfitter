/**
 * Demo action definition.
 *
 * @packageDocumentation
 */

import {
  type ActionSpec,
  defineAction,
  InternalError,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import { runDemo } from "../commands/demo.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
} from "../output-mode.js";
import { outputModeSchema } from "./shared.js";

interface DemoActionInput {
  animate?: boolean;
  list?: boolean;
  outputMode: CliOutputMode;
  section?: string;
}

const demoInputSchema = z.object({
  section: z.string().optional(),
  list: z.boolean().optional(),
  animate: z.boolean().optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<DemoActionInput>;

export const demoAction: ActionSpec<DemoActionInput, unknown> = defineAction({
  id: "demo",
  description: "Run the CLI demo app",
  surfaces: ["cli"],
  input: demoInputSchema,
  cli: {
    command: "demo [section]",
    description: "Run the CLI demo app",
    options: [
      {
        flags: "-l, --list",
        description: "List available demo sections",
        defaultValue: false,
      },
      {
        flags: "-a, --animate",
        description: "Run animated demo (spinners only)",
        defaultValue: false,
      },
    ],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      const section = context.args[0] as string | undefined;
      return {
        ...(section !== undefined ? { section } : {}),
        list: Boolean(context.flags["list"]),
        animate: Boolean(context.flags["animate"]),
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...demoInput } = input;
    try {
      const result = await runDemo({ ...demoInput, outputMode });
      if (result.exitCode !== 0) {
        process.exit(result.exitCode);
      }

      return Result.ok(result);
    } catch (error) {
      return Result.err(
        new InternalError({
          message:
            error instanceof Error ? error.message : "Failed to run demo",
          context: { action: "demo" },
        })
      );
    }
  },
});

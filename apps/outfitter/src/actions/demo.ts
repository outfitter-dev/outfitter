/**
 * Demo action definition.
 *
 * @packageDocumentation
 */

import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";

import { runDemo } from "../commands/demo.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
} from "../output-mode.js";
import {
  outputModeSchema,
  toActionInternalErrorFromUnknown,
} from "./shared.js";

interface DemoActionInput {
  readonly animate?: boolean | undefined;
  readonly list?: boolean | undefined;
  readonly outputMode: CliOutputMode;
  readonly section?: string | undefined;
}

type DemoAction = ReturnType<typeof defineAction<DemoActionInput, unknown>>;

const demoInputSchema = z.object({
  section: z.string().optional(),
  list: z.boolean().optional(),
  animate: z.boolean().optional(),
  outputMode: outputModeSchema,
});

/** Run the interactive CLI demo showcasing TUI components and output modes. */
export const demoAction: DemoAction = defineAction({
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
        toActionInternalErrorFromUnknown("demo", error, "Failed to run demo")
      );
    }
  },
});

/**
 * Add action definitions.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { output } from "@outfitter/cli";
import { actionCliPresets } from "@outfitter/cli/actions";
import { cwdPreset, dryRunPreset, forcePreset } from "@outfitter/cli/flags";
import { defineAction, InternalError, Result } from "@outfitter/contracts";
import { z } from "zod";

import {
  type AddInput,
  listBlocks,
  printAddResults,
  runAdd,
} from "../commands/add.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
  resolveStructuredOutputMode,
} from "../output-mode.js";
import { outputModeSchema } from "./shared.js";

const addInputSchema = z.object({
  block: z.string(),
  force: z.boolean(),
  dryRun: z.boolean(),
  cwd: z.string().optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<AddInput & { outputMode: CliOutputMode }>;

const addSharedFlags = actionCliPresets(forcePreset(), dryRunPreset());
const addCwd = cwdPreset();

export const addAction = defineAction({
  id: "add",
  description: "Add a block from the registry to your project",
  surfaces: ["cli"],
  input: addInputSchema,
  cli: {
    group: "add",
    command: "<block>",
    description:
      "Add a block from the registry (claude, biome, lefthook, bootstrap, scaffolding)",
    options: [...addSharedFlags.options, ...addCwd.options],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      const { force, dryRun } = addSharedFlags.resolve(context);
      const { cwd: rawCwd } = addCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      return {
        block: context.args[0] as string,
        force,
        dryRun,
        cwd,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...addInput } = input;
    const result = await runAdd(addInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "add" },
        })
      );
    }

    await printAddResults(result.value, addInput.dryRun, { mode: outputMode });
    return Result.ok(result.value);
  },
});

export const listBlocksAction = defineAction({
  id: "add.list",
  description: "List available blocks",
  surfaces: ["cli"],
  input: z.object({ outputMode: outputModeSchema }) as z.ZodType<{
    outputMode: CliOutputMode;
  }>,
  cli: {
    group: "add",
    command: "list",
    description: "List available blocks",
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      return {
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const result = listBlocks();

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "add.list" },
        })
      );
    }

    const structuredMode = resolveStructuredOutputMode(input.outputMode);
    if (structuredMode) {
      await output({ blocks: result.value }, { mode: structuredMode });
    } else {
      const lines = [
        "Available blocks:",
        ...result.value.map((block) => `  - ${block}`),
      ];
      await output(lines, { mode: "human" });
    }

    return Result.ok({ blocks: result.value });
  },
});

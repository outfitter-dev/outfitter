/**
 * Add action definitions.
 *
 * @packageDocumentation
 */

import { output } from "@outfitter/cli";
import { actionCliPresets } from "@outfitter/cli/actions";
import { cwdPreset, dryRunPreset, forcePreset } from "@outfitter/cli/flags";
import { resolveOutputMode } from "@outfitter/cli/query";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";

import { listBlocks, printAddResults, runAdd } from "../commands/add.js";
import {
  type CliOutputMode,
  resolveStructuredOutputMode,
} from "../output-mode.js";
import {
  actionInternalErr,
  outputModeSchema,
  resolveCwdFromPreset,
} from "./shared.js";

interface AddActionInput {
  readonly block: string;
  readonly cwd?: string | undefined;
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly outputMode: CliOutputMode;
}

const addInputSchema = z.object({
  block: z.string(),
  force: z.boolean(),
  dryRun: z.boolean(),
  cwd: z.string().optional(),
  outputMode: outputModeSchema,
});

const addSharedFlags = actionCliPresets(forcePreset(), dryRunPreset());
const addCwd = cwdPreset();

type AddAction = ReturnType<typeof defineAction<AddActionInput, unknown>>;

/** Add a block from the registry to the current project. */
export const addAction: AddAction = defineAction({
  id: "add",
  description: "Add a block from the registry to your project",
  surfaces: ["cli"],
  input: addInputSchema,
  cli: {
    group: "add",
    command: "<block>",
    description:
      "Add a block from the registry (claude, linter, lefthook, bootstrap, scaffolding)",
    options: [...addSharedFlags.options, ...addCwd.options],
    mapInput: (context) => {
      const { mode: outputMode } = resolveOutputMode(context.flags);
      const { force, dryRun } = addSharedFlags.resolve(context);
      return {
        block: context.args[0] as string,
        force,
        dryRun,
        cwd: resolveCwdFromPreset(context.flags, addCwd),
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, cwd, ...addInput } = input;
    const result = await runAdd({
      ...addInput,
      ...(cwd !== undefined ? { cwd } : {}),
    });

    if (result.isErr()) {
      return actionInternalErr("add", result.error);
    }

    await printAddResults(result.value, addInput.dryRun, { mode: outputMode });
    return Result.ok(result.value);
  },
});

const listBlocksInputSchema = z.object({ outputMode: outputModeSchema });

type ListBlocksAction = ReturnType<
  typeof defineAction<{ outputMode: CliOutputMode }, unknown>
>;

/** List all blocks available in the registry. */
export const listBlocksAction: ListBlocksAction = defineAction({
  id: "add.list",
  description: "List available blocks",
  surfaces: ["cli"],
  input: listBlocksInputSchema,
  cli: {
    group: "add",
    command: "list",
    description: "List available blocks",
    mapInput: (context) => {
      const { mode: outputMode } = resolveOutputMode(context.flags);
      return {
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const result = listBlocks();

    if (result.isErr()) {
      return actionInternalErr("add.list", result.error);
    }

    const structuredMode = resolveStructuredOutputMode(input.outputMode);
    if (structuredMode) {
      await output({ blocks: result.value }, structuredMode);
    } else {
      const lines = [
        "Available blocks:",
        ...result.value.map((block) => `  - ${block}`),
      ];
      await output(lines, "human");
    }

    return Result.ok({ blocks: result.value });
  },
});

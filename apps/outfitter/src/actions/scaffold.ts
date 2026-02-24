/**
 * Scaffold action definition.
 *
 * @packageDocumentation
 */

import { actionCliPresets } from "@outfitter/cli/actions";
import { dryRunPreset, forcePreset } from "@outfitter/cli/flags";
import { defineAction, InternalError, Result } from "@outfitter/contracts";
import { z } from "zod";

import { printScaffoldResults, runScaffold } from "../commands/scaffold.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
} from "../output-mode.js";
import {
  outputModeSchema,
  resolveInstallTimeoutFlag,
  resolveLocalFlag,
  resolveNoToolingFlag,
  resolveStringFlag,
} from "./shared.js";

interface ScaffoldFlags {
  readonly dryRun?: unknown;
  readonly force?: unknown;
  readonly installTimeout?: unknown;
  readonly local?: unknown;
  readonly noTooling?: unknown;
  readonly skipInstall?: unknown;
  readonly tooling?: unknown;
  readonly with?: unknown;
  readonly workspace?: unknown;
}

interface ScaffoldActionInput {
  cwd: string;
  dryRun: boolean;
  force: boolean;
  installTimeout?: number | undefined;
  local?: boolean | undefined;
  name?: string | undefined;
  noTooling?: boolean | undefined;
  outputMode: CliOutputMode;
  skipInstall: boolean;
  target: string;
  with?: string | undefined;
}

const scaffoldInputSchema = z.object({
  target: z.string(),
  name: z.string().optional(),
  force: z.boolean(),
  skipInstall: z.boolean(),
  dryRun: z.boolean(),
  with: z.string().optional(),
  noTooling: z.boolean().optional(),
  local: z.boolean().optional(),
  installTimeout: z.number().optional(),
  cwd: z.string(),
  outputMode: outputModeSchema,
}) as z.ZodType<ScaffoldActionInput>;

const scaffoldSharedFlags = actionCliPresets(forcePreset(), dryRunPreset());

function resolveScaffoldOptions(context: {
  args: readonly unknown[];
  flags: Record<string, unknown>;
}): ScaffoldActionInput {
  const flags = context.flags as ScaffoldFlags;
  const { force, dryRun } = scaffoldSharedFlags.resolve(context);
  const outputMode = resolveOutputModeFromContext(context.flags);
  const noTooling = resolveNoToolingFlag(flags);
  const local = resolveLocalFlag(flags);
  const installTimeout = resolveInstallTimeoutFlag(flags.installTimeout);

  return {
    target: String(context.args[0] ?? ""),
    name: resolveStringFlag(context.args[1]),
    force,
    skipInstall: Boolean(flags.skipInstall ?? context.flags["skip-install"]),
    dryRun,
    ...(local !== undefined ? { local } : {}),
    with: resolveStringFlag(flags.with),
    ...(noTooling !== undefined ? { noTooling } : {}),
    ...(installTimeout !== undefined ? { installTimeout } : {}),
    cwd: process.cwd(),
    outputMode,
  };
}

export const scaffoldAction = defineAction({
  id: "scaffold",
  description: "Add a capability to an existing project",
  surfaces: ["cli"],
  input: scaffoldInputSchema,
  cli: {
    command: "scaffold <target> [name]",
    description:
      "Add a capability (cli, mcp, daemon, lib, ...) to an existing project",
    options: [
      ...scaffoldSharedFlags.options,
      {
        flags: "--skip-install",
        description: "Skip bun install",
        defaultValue: false,
      },
      {
        flags: "--with <blocks>",
        description: "Comma-separated tooling blocks to add",
      },
      {
        flags: "--no-tooling",
        description: "Skip default tooling blocks",
      },
      {
        flags: "--local",
        description: "Use workspace:* for @outfitter dependencies",
      },
      {
        flags: "--install-timeout <ms>",
        description: "bun install timeout in milliseconds",
      },
    ],
    mapInput: resolveScaffoldOptions,
  },
  handler: async (input) => {
    const { outputMode, ...scaffoldInput } = input;
    const result = await runScaffold(scaffoldInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "scaffold" },
        })
      );
    }

    await printScaffoldResults(result.value, { mode: outputMode });
    return Result.ok(result.value);
  },
});

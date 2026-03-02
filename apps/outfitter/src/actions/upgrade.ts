/**
 * Upgrade action definitions.
 *
 * Includes the main `upgrade` command (version scanning and migration)
 * and the `upgrade codemod` subcommand (Commander-to-builder transformation).
 *
 * @packageDocumentation
 */

import { actionCliPresets } from "@outfitter/cli/actions";
import {
  booleanFlagPreset,
  cwdPreset,
  dryRunPreset,
  interactionPreset,
} from "@outfitter/cli/flags";
import { resolveOutputMode } from "@outfitter/cli/query";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";

import {
  printUpgradeCodemodBuilderResult,
  runUpgradeCodemodBuilder,
} from "../commands/upgrade-codemod-builder.js";
import { printUpgradeResults, runUpgrade } from "../commands/upgrade.js";
import type { CliOutputMode } from "../output-mode.js";
import {
  actionInternalErr,
  outputModeSchema,
  resolveCwdFromPreset,
} from "./shared.js";

interface UpgradeActionInput {
  readonly all: boolean;
  readonly cwd: string;
  readonly dryRun: boolean;
  readonly guide: boolean;
  readonly guidePackages?: string[] | undefined;
  readonly interactive: boolean;
  readonly noCodemods: boolean;
  readonly outputMode: CliOutputMode;
  readonly yes: boolean;
}

type UpgradeAction = ReturnType<
  typeof defineAction<UpgradeActionInput, unknown>
>;

const upgradeInputSchema = z.object({
  cwd: z.string(),
  guide: z.boolean(),
  guidePackages: z.array(z.string()).optional(),
  dryRun: z.boolean(),
  yes: z.boolean(),
  interactive: z.boolean(),
  all: z.boolean(),
  noCodemods: z.boolean(),
  outputMode: outputModeSchema,
});

const upgradeCwd = cwdPreset();
const upgradeDryRun = dryRunPreset();
const upgradeInteraction = interactionPreset();
const upgradeAll = booleanFlagPreset({
  id: "upgradeAll",
  key: "all",
  flags: "--all",
  description: "Include breaking changes in the upgrade",
});
const upgradeNoCodemods = booleanFlagPreset({
  id: "upgradeNoCodemods",
  key: "noCodemods",
  flags: "--no-codemods",
  description: "Skip automatic codemod execution during upgrade",
  sources: ["noCodemods", "no-codemods"],
  negatedSources: ["codemods"],
});
const upgradeGuide = booleanFlagPreset({
  id: "upgradeGuide",
  key: "guide",
  flags: "--guide",
  description:
    "Show migration instructions for available updates. Pass package names to filter.",
});
const upgradeFlags = actionCliPresets(
  upgradeCwd,
  upgradeDryRun,
  upgradeInteraction,
  upgradeAll,
  upgradeNoCodemods,
  upgradeGuide
);

/** Check for available `@outfitter/*` package updates and show migration guidance. */
export const upgradeAction: UpgradeAction = defineAction({
  id: "upgrade",
  description: "Check for @outfitter/* package updates and migration guidance",
  surfaces: ["cli"],
  input: upgradeInputSchema,
  cli: {
    group: "upgrade",
    command: "[packages...]",
    description:
      "Check for @outfitter/* package updates and migration guidance",
    options: [...upgradeFlags.options],
    mapInput: (context) => {
      const { mode: outputMode } = resolveOutputMode(context.flags);
      const { dryRun, interactive, yes, all, noCodemods, guide } =
        upgradeFlags.resolve(context);
      const guidePackages =
        context.args.length > 0 ? (context.args as string[]) : undefined;
      return {
        cwd: resolveCwdFromPreset(context.flags, upgradeCwd),
        guide,
        ...(guidePackages !== undefined ? { guidePackages } : {}),
        dryRun,
        yes,
        interactive,
        all,
        noCodemods,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, guidePackages, ...upgradeInput } = input;
    const result = await runUpgrade({
      ...upgradeInput,
      outputMode,
      ...(guidePackages !== undefined ? { guidePackages } : {}),
    });

    if (result.isErr()) {
      return actionInternalErr("upgrade", result.error);
    }

    await printUpgradeResults(result.value, {
      mode: outputMode,
      guide: upgradeInput.guide,
      cwd: upgradeInput.cwd,
      dryRun: upgradeInput.dryRun,
      all: upgradeInput.all,
    });

    return Result.ok(result.value);
  },
});

// =============================================================================
// upgrade codemod action
// =============================================================================

interface UpgradeCodemodInput {
  readonly cwd: string;
  readonly dryRun: boolean;
  readonly outputMode: CliOutputMode;
}

type UpgradeCodemodAction = ReturnType<
  typeof defineAction<UpgradeCodemodInput, unknown>
>;

const upgradeCodemodInputSchema = z.object({
  cwd: z.string(),
  dryRun: z.boolean(),
  outputMode: outputModeSchema,
});

const codemodCwd = cwdPreset();
const codemodDryRun = dryRunPreset();
const codemodFlags = actionCliPresets(codemodCwd, codemodDryRun);

/** Run Commander-to-builder codemod transformation on a target directory. */
export const upgradeCodemodAction: UpgradeCodemodAction = defineAction({
  id: "upgrade.codemod",
  description:
    "Transform Commander .command().action() patterns to builder .input(schema).action()",
  surfaces: ["cli"],
  input: upgradeCodemodInputSchema,
  cli: {
    group: "upgrade",
    command: "codemod",
    description:
      "Transform Commander .command().action() patterns to builder .input(schema).action()",
    options: [...codemodFlags.options],
    mapInput: (context) => {
      const { mode: outputMode } = resolveOutputMode(context.flags);
      return {
        cwd: resolveCwdFromPreset(context.flags, codemodCwd),
        dryRun: codemodFlags.resolve(context).dryRun,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...codemodInput } = input;
    const result = await runUpgradeCodemodBuilder(codemodInput);

    if (result.isErr()) {
      return actionInternalErr("upgrade.codemod", result.error);
    }

    await printUpgradeCodemodBuilderResult(result.value, {
      mode: outputMode,
    });

    if (!result.value.ok) {
      return actionInternalErr("upgrade.codemod", {
        message: `Codemod completed with ${result.value.errors.length} error(s)`,
      });
    }

    return Result.ok(result.value);
  },
});

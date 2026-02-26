/**
 * Upgrade action definition.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { actionCliPresets } from "@outfitter/cli/actions";
import {
  booleanFlagPreset,
  cwdPreset,
  dryRunPreset,
  interactionPreset,
} from "@outfitter/cli/flags";
import {
  type ActionSpec,
  defineAction,
  InternalError,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import { printUpgradeResults, runUpgrade } from "../commands/upgrade.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
} from "../output-mode.js";
import { outputModeSchema } from "./shared.js";

interface UpgradeActionInput {
  all: boolean;
  cwd: string;
  dryRun: boolean;
  guide: boolean;
  guidePackages?: string[];
  interactive: boolean;
  noCodemods: boolean;
  outputMode: CliOutputMode;
  yes: boolean;
}

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
}) as z.ZodType<UpgradeActionInput>;

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

const _upgradeAction: ActionSpec<UpgradeActionInput, unknown> = defineAction<
  UpgradeActionInput,
  unknown
>({
  id: "upgrade",
  description: "Check for @outfitter/* package updates and migration guidance",
  surfaces: ["cli"],
  input: upgradeInputSchema,
  cli: {
    command: "upgrade [packages...]",
    description:
      "Check for @outfitter/* package updates and migration guidance",
    options: [...upgradeFlags.options],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      const {
        cwd: rawCwd,
        dryRun,
        interactive,
        yes,
        all,
        noCodemods,
        guide,
      } = upgradeFlags.resolve(context);
      const cwd = resolve(process.cwd(), rawCwd);
      const guidePackages =
        context.args.length > 0 ? (context.args as string[]) : undefined;
      return {
        cwd,
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
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "upgrade" },
        })
      );
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
export const upgradeAction: typeof _upgradeAction = _upgradeAction;

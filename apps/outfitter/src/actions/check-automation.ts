/**
 * Additional `outfitter check` subcommands for repository automation checks.
 *
 * @packageDocumentation
 */

import { cwdPreset } from "@outfitter/cli/flags";
import { outputModePreset } from "@outfitter/cli/query";
import { defineAction, Result } from "@outfitter/contracts";
import { z } from "zod";

import {
  printCheckDocsSentinelResult,
  runCheckDocsSentinel,
} from "../commands/check-docs-sentinel.js";
import {
  printCheckPresetVersionsResult,
  runCheckPresetVersions,
} from "../commands/check-preset-versions.js";
import {
  printCheckPublishGuardrailsResult,
  runCheckPublishGuardrails,
} from "../commands/check-publish-guardrails.js";
import {
  printCheckSurfaceMapFormatResult,
  runCheckSurfaceMapFormat,
} from "../commands/check-surface-map-format.js";
import {
  printCheckSurfaceMapResult,
  runCheckSurfaceMap,
} from "../commands/check-surface-map.js";
import {
  type CliOutputMode,
  resolveStructuredOutputMode,
} from "../output-mode.js";
import {
  actionInternalErr,
  outputModeSchema,
  resolveCwdFromPreset,
  resolveOutputModeWithEnvFallback,
} from "./shared.js";

interface CheckAutomationInput {
  cwd: string;
  outputMode: CliOutputMode;
}

type CheckAutomationAction = ReturnType<
  typeof defineAction<CheckAutomationInput, unknown>
>;

const checkAutomationInputSchema = z.object({
  cwd: z.string(),
  outputMode: outputModeSchema,
});

const checkAutomationOutput = outputModePreset();
const checkAutomationCwd = cwdPreset();

function mapCheckAutomationInput(context: {
  readonly flags: Record<string, unknown>;
}): CheckAutomationInput {
  const { outputMode: presetOutputMode } = checkAutomationOutput.resolve(
    context.flags
  );
  const outputMode = resolveOutputModeWithEnvFallback(
    context.flags,
    resolveStructuredOutputMode(presetOutputMode) ?? "human"
  );

  return {
    cwd: resolveCwdFromPreset(context.flags, checkAutomationCwd),
    outputMode,
  };
}

export const checkPublishGuardrailsAction: CheckAutomationAction = defineAction(
  {
    id: "check.publish-guardrails",
    description:
      "Validate publishable package manifests enforce prepublishOnly guardrails",
    surfaces: ["cli"],
    input: checkAutomationInputSchema,
    cli: {
      group: "check",
      command: "publish-guardrails",
      description:
        "Validate publishable package manifests enforce prepublishOnly guardrails",
      options: [
        ...checkAutomationOutput.options,
        ...checkAutomationCwd.options,
      ],
      mapInput: mapCheckAutomationInput,
    },
    handler: async (input) => {
      const result = await runCheckPublishGuardrails({ cwd: input.cwd });
      if (result.isErr()) {
        return actionInternalErr("check.publish-guardrails", result.error);
      }

      await printCheckPublishGuardrailsResult(result.value, {
        mode: input.outputMode,
      });

      if (!result.value.ok) {
        process.exit(1);
      }

      return Result.ok(result.value);
    },
  }
);

export const checkPresetVersionsAction: CheckAutomationAction = defineAction({
  id: "check.preset-versions",
  description:
    "Validate preset dependency versions, registry versions, and Bun version consistency",
  surfaces: ["cli"],
  input: checkAutomationInputSchema,
  cli: {
    group: "check",
    command: "preset-versions",
    description:
      "Validate preset dependency versions, registry versions, and Bun version consistency",
    options: [...checkAutomationOutput.options, ...checkAutomationCwd.options],
    mapInput: mapCheckAutomationInput,
  },
  handler: async (input) => {
    const result = await runCheckPresetVersions({ cwd: input.cwd });
    if (result.isErr()) {
      return actionInternalErr("check.preset-versions", result.error);
    }

    await printCheckPresetVersionsResult(result.value, {
      mode: input.outputMode,
    });

    if (!result.value.ok) {
      process.exit(1);
    }

    return Result.ok(result.value);
  },
});

export const checkSurfaceMapAction: CheckAutomationAction = defineAction({
  id: "check.surface-map",
  description:
    "Validate canonical surface map path usage (.outfitter/surface.json only)",
  surfaces: ["cli"],
  input: checkAutomationInputSchema,
  cli: {
    group: "check",
    command: "surface-map",
    description:
      "Validate canonical surface map path usage (.outfitter/surface.json only)",
    options: [...checkAutomationOutput.options, ...checkAutomationCwd.options],
    mapInput: mapCheckAutomationInput,
  },
  handler: async (input) => {
    const result = await runCheckSurfaceMap({ cwd: input.cwd });
    if (result.isErr()) {
      return actionInternalErr("check.surface-map", result.error);
    }

    await printCheckSurfaceMapResult(result.value, {
      mode: input.outputMode,
    });

    if (!result.value.ok) {
      process.exit(1);
    }

    return Result.ok(result.value);
  },
});

export const checkSurfaceMapFormatAction: CheckAutomationAction = defineAction({
  id: "check.surface-map-format",
  description: "Validate canonical formatting for .outfitter/surface.json",
  surfaces: ["cli"],
  input: checkAutomationInputSchema,
  cli: {
    group: "check",
    command: "surface-map-format",
    description: "Validate canonical formatting for .outfitter/surface.json",
    options: [...checkAutomationOutput.options, ...checkAutomationCwd.options],
    mapInput: mapCheckAutomationInput,
  },
  handler: async (input) => {
    const result = await runCheckSurfaceMapFormat({ cwd: input.cwd });
    if (result.isErr()) {
      return actionInternalErr("check.surface-map-format", result.error);
    }

    await printCheckSurfaceMapFormatResult(result.value, {
      mode: input.outputMode,
    });

    if (!result.value.ok) {
      process.exit(1);
    }

    return Result.ok(result.value);
  },
});

export const checkDocsSentinelAction: CheckAutomationAction = defineAction({
  id: "check.docs-sentinel",
  description: "Validate docs/README.md PACKAGE_LIST sentinel freshness",
  surfaces: ["cli"],
  input: checkAutomationInputSchema,
  cli: {
    group: "check",
    command: "docs-sentinel",
    description: "Validate docs/README.md PACKAGE_LIST sentinel freshness",
    options: [...checkAutomationOutput.options, ...checkAutomationCwd.options],
    mapInput: mapCheckAutomationInput,
  },
  handler: async (input) => {
    const result = await runCheckDocsSentinel({ cwd: input.cwd });
    if (result.isErr()) {
      return actionInternalErr("check.docs-sentinel", result.error);
    }

    await printCheckDocsSentinelResult(result.value, {
      mode: input.outputMode,
    });

    if (!result.value.ok) {
      process.exit(1);
    }

    return Result.ok(result.value);
  },
});

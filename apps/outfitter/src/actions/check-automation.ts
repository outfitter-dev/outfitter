/**
 * Additional `outfitter check` subcommands for repository automation checks.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { cwdPreset } from "@outfitter/cli/flags";
import { outputModePreset } from "@outfitter/cli/query";
import {
  type ActionSpec,
  defineAction,
  InternalError,
  Result,
} from "@outfitter/contracts";
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
import { outputModeSchema } from "./shared.js";

interface CheckAutomationInput {
  cwd: string;
  outputMode: CliOutputMode;
}

const checkAutomationInputSchema = z.object({
  cwd: z.string(),
  outputMode: outputModeSchema,
}) as z.ZodType<CheckAutomationInput>;

const checkAutomationOutput = outputModePreset();
const checkAutomationCwd = cwdPreset();

function mapCheckAutomationInput(context: {
  readonly flags: Record<string, unknown>;
}): CheckAutomationInput {
  const { outputMode: presetOutputMode } = checkAutomationOutput.resolve(
    context.flags
  );
  const explicitOutput = typeof context.flags["output"] === "string";

  let outputMode: CliOutputMode;
  if (explicitOutput) {
    outputMode = resolveStructuredOutputMode(presetOutputMode) ?? "human";
  } else if (process.env["OUTFITTER_JSONL"] === "1") {
    outputMode = "jsonl";
  } else if (process.env["OUTFITTER_JSON"] === "1") {
    outputMode = "json";
  } else {
    outputMode = "human";
  }

  const { cwd: rawCwd } = checkAutomationCwd.resolve(context.flags);

  return {
    cwd: resolve(process.cwd(), rawCwd),
    outputMode,
  };
}

const _checkPublishGuardrailsAction: ActionSpec<CheckAutomationInput, unknown> =
  defineAction({
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
        return Result.err(
          new InternalError({
            message: result.error.message,
            context: { action: "check.publish-guardrails" },
          })
        );
      }

      await printCheckPublishGuardrailsResult(result.value, {
        mode: input.outputMode,
      });

      if (!result.value.ok) {
        process.exit(1);
      }

      return Result.ok(result.value);
    },
  });
export const checkPublishGuardrailsAction: typeof _checkPublishGuardrailsAction =
  _checkPublishGuardrailsAction;

const _checkPresetVersionsAction: ActionSpec<CheckAutomationInput, unknown> =
  defineAction({
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
      options: [
        ...checkAutomationOutput.options,
        ...checkAutomationCwd.options,
      ],
      mapInput: mapCheckAutomationInput,
    },
    handler: async (input) => {
      const result = await runCheckPresetVersions({ cwd: input.cwd });
      if (result.isErr()) {
        return Result.err(
          new InternalError({
            message: result.error.message,
            context: { action: "check.preset-versions" },
          })
        );
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
export const checkPresetVersionsAction: typeof _checkPresetVersionsAction =
  _checkPresetVersionsAction;

const _checkSurfaceMapAction: ActionSpec<CheckAutomationInput, unknown> =
  defineAction({
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
      options: [
        ...checkAutomationOutput.options,
        ...checkAutomationCwd.options,
      ],
      mapInput: mapCheckAutomationInput,
    },
    handler: async (input) => {
      const result = await runCheckSurfaceMap({ cwd: input.cwd });
      if (result.isErr()) {
        return Result.err(
          new InternalError({
            message: result.error.message,
            context: { action: "check.surface-map" },
          })
        );
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
export const checkSurfaceMapAction: typeof _checkSurfaceMapAction =
  _checkSurfaceMapAction;

const _checkSurfaceMapFormatAction: ActionSpec<CheckAutomationInput, unknown> =
  defineAction({
    id: "check.surface-map-format",
    description: "Validate canonical formatting for .outfitter/surface.json",
    surfaces: ["cli"],
    input: checkAutomationInputSchema,
    cli: {
      group: "check",
      command: "surface-map-format",
      description: "Validate canonical formatting for .outfitter/surface.json",
      options: [
        ...checkAutomationOutput.options,
        ...checkAutomationCwd.options,
      ],
      mapInput: mapCheckAutomationInput,
    },
    handler: async (input) => {
      const result = await runCheckSurfaceMapFormat({ cwd: input.cwd });
      if (result.isErr()) {
        return Result.err(
          new InternalError({
            message: result.error.message,
            context: { action: "check.surface-map-format" },
          })
        );
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
export const checkSurfaceMapFormatAction: typeof _checkSurfaceMapFormatAction =
  _checkSurfaceMapFormatAction;

const _checkDocsSentinelAction: ActionSpec<CheckAutomationInput, unknown> =
  defineAction({
    id: "check.docs-sentinel",
    description: "Validate docs/README.md PACKAGE_LIST sentinel freshness",
    surfaces: ["cli"],
    input: checkAutomationInputSchema,
    cli: {
      group: "check",
      command: "docs-sentinel",
      description: "Validate docs/README.md PACKAGE_LIST sentinel freshness",
      options: [
        ...checkAutomationOutput.options,
        ...checkAutomationCwd.options,
      ],
      mapInput: mapCheckAutomationInput,
    },
    handler: async (input) => {
      const result = await runCheckDocsSentinel({ cwd: input.cwd });
      if (result.isErr()) {
        return Result.err(
          new InternalError({
            message: result.error.message,
            context: { action: "check.docs-sentinel" },
          })
        );
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
export const checkDocsSentinelAction: typeof _checkDocsSentinelAction =
  _checkDocsSentinelAction;

/**
 * Check action definitions.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { cwdPreset, verbosePreset } from "@outfitter/cli/flags";
import { jqPreset, outputModePreset } from "@outfitter/cli/query";
import {
  type ActionCliOption,
  type ActionSpec,
  defineAction,
  InternalError,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import type { TsDocCheckResult } from "@outfitter/tooling";
import { z } from "zod";

import {
  type CheckOrchestratorMode,
  printCheckOrchestratorResults,
  runCheckOrchestrator,
} from "../commands/check-orchestrator.js";
import { runCheckTsdoc } from "../commands/check-tsdoc.js";
import { printCheckResults, runCheck } from "../commands/check.js";
import {
  type CliOutputMode,
  resolveStructuredOutputMode,
} from "../output-mode.js";
import { outputModeSchema, resolveStringFlag } from "./shared.js";

interface CheckActionInput {
  block?: string;
  cwd: string;
  mode?: CheckOrchestratorMode;
  outputMode: CliOutputMode;
  stagedFiles?: readonly string[];
  verbose: boolean;
}

const checkOrchestratorModes = ["all", "ci", "pre-commit", "pre-push"] as const;

const checkInputSchema = z.object({
  cwd: z.string(),
  verbose: z.boolean(),
  block: z.string().optional(),
  mode: z.enum(checkOrchestratorModes).optional(),
  stagedFiles: z.array(z.string()).optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<CheckActionInput>;

const checkVerbose = verbosePreset();
const checkCwd = cwdPreset();
const checkOutputMode = outputModePreset();
const checkVerboseOptions: ActionCliOption[] = checkVerbose.options.map(
  (option) =>
    option.flags === "-v, --verbose"
      ? { ...option, description: "Show diffs for drifted files" }
      : option
);

function resolveCheckMode(
  flags: Record<string, unknown>
): CheckOrchestratorMode | undefined {
  const requestedModes: CheckOrchestratorMode[] = [];
  if (flags["all"] === true) {
    requestedModes.push("all");
  }
  if (flags["ci"] === true) {
    requestedModes.push("ci");
  }
  if (flags["preCommit"] === true) {
    requestedModes.push("pre-commit");
  }
  if (flags["prePush"] === true) {
    requestedModes.push("pre-push");
  }

  if (requestedModes.length > 1) {
    throw ValidationError.fromMessage(
      "Use only one of --all, --ci, --pre-commit, or --pre-push."
    );
  }

  return requestedModes[0];
}

const _checkAction: ActionSpec<CheckActionInput, unknown> = defineAction({
  id: "check",
  description:
    "Compare local config blocks against the registry for drift detection",
  surfaces: ["cli"],
  input: checkInputSchema,
  cli: {
    group: "check",
    // Accept optional staged-file args for hook-driven `--pre-commit` mode.
    // Using an argument-only command spec keeps this as the base `check`
    // command (without rendering `check check` in schema output).
    command: "[staged-files...]",
    description:
      "Compare local config blocks against the registry for drift detection",
    options: [
      ...checkVerboseOptions,
      {
        flags: "--all",
        description: "Run the full check orchestrator",
        defaultValue: false,
      },
      {
        flags: "--ci",
        description: "Run CI check orchestration (includes tests)",
        defaultValue: false,
      },
      {
        flags: "--pre-commit",
        description: "Run pre-commit check orchestration",
        defaultValue: false,
      },
      {
        flags: "--pre-push",
        description: "Run pre-push check orchestration",
        defaultValue: false,
      },
      {
        flags: "-b, --block <name>",
        description: "Check a specific block only",
      },
      ...checkOutputMode.options,
      ...checkCwd.options,
    ],
    mapInput: (context) => {
      const mode = resolveCheckMode(context.flags);
      const { outputMode: presetOutputMode } = checkOutputMode.resolve(
        context.flags
      );
      const explicitOutput = typeof context.flags["output"] === "string";
      const block = resolveStringFlag(context.flags["block"]);
      if (mode !== undefined && block !== undefined) {
        throw ValidationError.fromMessage(
          "--block cannot be combined with orchestrator mode flags."
        );
      }

      const stagedFiles =
        mode === "pre-commit"
          ? context.args.filter(
              (arg): arg is string =>
                typeof arg === "string" && arg.trim().length > 0
            )
          : undefined;
      let outputMode: CliOutputMode;
      if (explicitOutput) {
        // Explicit --output should always win over env fallbacks.
        outputMode = resolveStructuredOutputMode(presetOutputMode) ?? "human";
      } else if (mode !== undefined) {
        // Orchestrator mode should not inherit JSON env defaults implicitly.
        outputMode = "human";
      } else if (process.env["OUTFITTER_JSONL"] === "1") {
        outputMode = "jsonl";
      } else if (process.env["OUTFITTER_JSON"] === "1") {
        outputMode = "json";
      } else {
        outputMode = "human";
      }
      const { verbose } = checkVerbose.resolve(context.flags);
      const { cwd: rawCwd } = checkCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      return {
        cwd,
        verbose,
        ...(block !== undefined ? { block } : {}),
        ...(mode !== undefined ? { mode } : {}),
        ...(stagedFiles !== undefined ? { stagedFiles } : {}),
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, mode, stagedFiles, ...checkInput } = input;

    if (mode !== undefined) {
      const orchestratorResult = await runCheckOrchestrator({
        cwd: checkInput.cwd,
        mode,
        ...(stagedFiles && stagedFiles.length > 0 ? { stagedFiles } : {}),
      });

      if (orchestratorResult.isErr()) {
        return Result.err(
          new InternalError({
            message: orchestratorResult.error.message,
            context: { action: "check" },
          })
        );
      }

      await printCheckOrchestratorResults(orchestratorResult.value, {
        mode: outputMode,
      });

      if (!orchestratorResult.value.ok) {
        process.exit(1);
      }

      return Result.ok(orchestratorResult.value);
    }

    const result = await runCheck(checkInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "check" },
        })
      );
    }

    await printCheckResults(result.value, {
      mode: outputMode,
      verbose: checkInput.verbose,
    });

    // Exit code 1 if any blocks drifted or missing
    if (result.value.driftedCount > 0 || result.value.missingCount > 0) {
      process.exit(1);
    }

    return Result.ok(result.value);
  },
});
export const checkAction: typeof _checkAction = _checkAction;

interface CheckTsDocActionInput {
  cwd: string;
  jq: string | undefined;
  level: "documented" | "partial" | "undocumented" | undefined;
  minCoverage: number;
  outputMode: CliOutputMode;
  packages: readonly string[];
  strict: boolean;
  summary: boolean;
}

const checkTsdocInputSchema = z.object({
  strict: z.boolean(),
  minCoverage: z.number(),
  cwd: z.string(),
  outputMode: outputModeSchema,
  jq: z.string().optional(),
  summary: z.boolean(),
  level: z.enum(["documented", "partial", "undocumented"]).optional(),
  packages: z.array(z.string()),
}) as z.ZodType<CheckTsDocActionInput>;

export const checkTsdocOutputSchema = z.object({
  ok: z.boolean(),
  packages: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      declarations: z.array(
        z.object({
          name: z.string(),
          kind: z.string(),
          level: z.enum(["documented", "partial", "undocumented"]),
          file: z.string(),
          line: z.number(),
        })
      ),
      documented: z.number(),
      partial: z.number(),
      undocumented: z.number(),
      total: z.number(),
      percentage: z.number(),
    })
  ),
  summary: z.object({
    documented: z.number(),
    partial: z.number(),
    undocumented: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
}) as z.ZodType<TsDocCheckResult>;

const checkTsdocOutputMode = outputModePreset({ includeJsonl: true });
const checkTsdocJq = jqPreset();

const _checkTsdocAction: ActionSpec<
  CheckTsDocActionInput,
  TsDocCheckResult,
  ValidationError | InternalError
> = defineAction<
  CheckTsDocActionInput,
  TsDocCheckResult,
  ValidationError | InternalError
>({
  id: "check.tsdoc",
  description: "Check TSDoc coverage on exported declarations",
  surfaces: ["cli"],
  input: checkTsdocInputSchema,
  output: checkTsdocOutputSchema,
  cli: {
    group: "check",
    command: "tsdoc",
    description: "Check TSDoc coverage on exported declarations",
    options: [
      {
        flags: "--strict",
        description: "Fail if coverage is below the minimum threshold",
        defaultValue: false,
      },
      {
        flags: "--min-coverage <percent>",
        description: "Minimum coverage percentage (used with --strict)",
      },
      {
        flags: "--summary",
        description:
          "Omit per-declaration detail for compact output (~2KB vs ~64KB)",
        defaultValue: false,
      },
      {
        flags: "--level <level>",
        description:
          "Filter declarations by coverage level (undocumented, partial, documented)",
      },
      {
        flags: "--package <name>",
        description: "Filter to specific package(s) by name (repeatable)",
      },
      ...checkTsdocOutputMode.options,
      ...checkTsdocJq.options,
    ],
    mapInput: (context) => {
      const { outputMode: presetOutputMode } = checkTsdocOutputMode.resolve(
        context.flags
      );
      const { jq } = checkTsdocJq.resolve(context.flags);
      const explicitOutput = typeof context.flags["output"] === "string";
      let outputMode: CliOutputMode;
      if (explicitOutput) {
        // Explicit --output should always win over env fallbacks.
        outputMode = resolveStructuredOutputMode(presetOutputMode) ?? "human";
      } else if (process.env["OUTFITTER_JSONL"] === "1") {
        outputMode = "jsonl";
      } else if (process.env["OUTFITTER_JSON"] === "1") {
        outputMode = "json";
      } else {
        outputMode = "human";
      }
      const minCoverageRaw =
        context.flags["minCoverage"] ?? context.flags["min-coverage"];
      let minCoverage = 0;
      if (typeof minCoverageRaw === "string") {
        minCoverage = Number.parseInt(minCoverageRaw, 10);
      } else if (typeof minCoverageRaw === "number") {
        minCoverage = minCoverageRaw;
      }

      // Resolve --level flag
      const levelRaw = context.flags["level"];
      const validLevels = new Set(["documented", "partial", "undocumented"]);
      const level =
        typeof levelRaw === "string" && validLevels.has(levelRaw)
          ? (levelRaw as "documented" | "partial" | "undocumented")
          : undefined;

      // Resolve --package flag (Commander collects repeatable into array)
      const pkgRaw = context.flags["package"];
      let packages: string[] = [];
      if (Array.isArray(pkgRaw)) {
        packages = pkgRaw.filter((v): v is string => typeof v === "string");
      } else if (typeof pkgRaw === "string") {
        packages = [pkgRaw];
      }

      return {
        strict: Boolean(context.flags["strict"]),
        minCoverage,
        cwd: process.cwd(),
        outputMode,
        jq,
        summary: Boolean(context.flags["summary"]),
        level,
        packages,
      };
    },
  },
  handler: async (input) => {
    const result = await runCheckTsdoc(input);

    if (result.isErr()) {
      if (result.error instanceof ValidationError) {
        return Result.err(result.error);
      }

      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "check.tsdoc" },
        })
      );
    }

    if (!result.value.ok) {
      process.exitCode = 1;
    }

    return Result.ok(result.value);
  },
});
export const checkTsdocAction: typeof _checkTsdocAction = _checkTsdocAction;

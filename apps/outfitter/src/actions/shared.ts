/**
 * Shared action registry helpers.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { InternalError, Result } from "@outfitter/contracts";
import { z } from "zod";

export const outputModeSchema: z.ZodType<"human" | "json" | "jsonl"> = z
  .enum(["human", "json", "jsonl"])
  .default("human");

function argvContainsOutputFlag(argv: readonly string[]): boolean {
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      return true;
    }

    if (arg.startsWith("--output=") || arg.startsWith("-o=")) {
      return true;
    }
  }

  return false;
}

export function hasExplicitOutputFlag(
  flags: Record<string, unknown>,
  options: {
    readonly argv?: readonly string[];
    readonly defaultMode?: "human" | "json" | "jsonl";
  } = {}
): boolean {
  const mode = flags["output"];
  if (typeof mode !== "string") {
    return false;
  }

  const defaultMode = options.defaultMode ?? "human";
  if (mode !== defaultMode) {
    return true;
  }

  return argvContainsOutputFlag(options.argv ?? process.argv.slice(2));
}

export function resolveStringFlag(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function resolveNoToolingFlag(flags: {
  readonly noTooling?: unknown;
  readonly tooling?: unknown;
}): boolean | undefined {
  if (typeof flags.noTooling === "boolean") {
    return !flags.noTooling;
  }

  if (typeof flags.tooling === "boolean") {
    if (!flags.tooling) {
      return true;
    }

    return process.argv.includes("--tooling") ? false : undefined;
  }

  return undefined;
}

export function resolveLocalFlag(flags: {
  readonly local?: unknown;
  readonly workspace?: unknown;
}): boolean | undefined {
  if (flags.local === true || flags.workspace === true) {
    return true;
  }

  return undefined;
}

export function resolveInstallTimeoutFlag(value: unknown): number | undefined {
  if (typeof value === "string") {
    return Number.parseInt(value, 10);
  }

  if (typeof value === "number") {
    return value;
  }

  return undefined;
}

interface CwdPresetResolver {
  resolve(flags: Record<string, unknown>): { cwd: string };
}

export function resolveCwdFromPreset(
  flags: Record<string, unknown>,
  cwdPreset: CwdPresetResolver
): string {
  const { cwd: rawCwd } = cwdPreset.resolve(flags);
  return resolve(process.cwd(), rawCwd);
}

export function resolveOutputModeWithEnvFallback(
  flags: Record<string, unknown>,
  explicitMode: "human" | "json" | "jsonl",
  options: { readonly forceHumanWhenImplicit?: boolean } = {}
): "human" | "json" | "jsonl" {
  if (hasExplicitOutputFlag(flags)) {
    return explicitMode;
  }

  if (options.forceHumanWhenImplicit) {
    return "human";
  }

  if (process.env["OUTFITTER_JSONL"] === "1") {
    return "jsonl";
  }

  if (process.env["OUTFITTER_JSON"] === "1") {
    return "json";
  }

  return "human";
}

export function resolveBooleanFlagAlias(
  flags: Record<string, unknown>,
  key: string,
  alias: string
): boolean {
  return Boolean(flags[key] ?? flags[alias]);
}

interface ActionBoundaryErrorLike {
  readonly message: string;
}

export function toActionInternalError(
  action: string,
  error: ActionBoundaryErrorLike
): InternalError {
  return new InternalError({
    message: error.message,
    context: { action },
  });
}

export function actionInternalErr<T = never>(
  action: string,
  error: ActionBoundaryErrorLike
): Result<T, InternalError> {
  return Result.err<T, InternalError>(toActionInternalError(action, error));
}

export function toActionInternalErrorFromUnknown(
  action: string,
  error: unknown,
  fallbackMessage: string
): InternalError {
  return new InternalError({
    message: error instanceof Error ? error.message : fallbackMessage,
    context: { action },
  });
}

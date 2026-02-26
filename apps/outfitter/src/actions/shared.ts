/**
 * Shared action registry helpers.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import { InternalError, Result } from "@outfitter/contracts";
import { z } from "zod";

/** Zod schema for CLI output mode with "human" as the default. */
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

/**
 * Detect whether the user explicitly passed an output mode flag.
 *
 * Returns `true` when the resolved mode differs from the default,
 * or when `-o`/`--output` appears in the raw argv.
 */
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

/** Coerce a flag value to a non-empty string, or `undefined`. */
export function resolveStringFlag(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Resolve the `--no-tooling` / `--tooling` flag pair.
 *
 * Returns `true` to include tooling, `false` to skip, or `undefined`
 * when neither flag was provided.
 */
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

/** Resolve `--local` or its `--workspace` alias to a boolean, or `undefined` when absent. */
export function resolveLocalFlag(flags: {
  readonly local?: unknown;
  readonly workspace?: unknown;
}): boolean | undefined {
  if (flags.local === true || flags.workspace === true) {
    return true;
  }

  return undefined;
}

/** Parse `--install-timeout` as an integer, accepting string or number input. */
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

/** Resolve the working directory from a `cwdPreset`, making relative paths absolute. */
export function resolveCwdFromPreset(
  flags: Record<string, unknown>,
  cwdPreset: CwdPresetResolver
): string {
  const { cwd: rawCwd } = cwdPreset.resolve(flags);
  return resolve(process.cwd(), rawCwd);
}

/**
 * Resolve output mode with environment variable fallback.
 *
 * When the user did not pass an explicit flag, checks
 * `OUTFITTER_JSONL` and `OUTFITTER_JSON` before defaulting to "human".
 */
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

/** Resolve a boolean flag that may appear under either its camelCase key or its kebab-case alias. */
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

/** Wrap an error at the action boundary into a tagged `InternalError`. */
export function toActionInternalError(
  action: string,
  error: ActionBoundaryErrorLike
): InternalError {
  return new InternalError({
    message: error.message,
    context: { action },
  });
}

/** Shorthand for returning `Result.err` with a tagged `InternalError` from an action handler. */
export function actionInternalErr<T = never>(
  action: string,
  error: ActionBoundaryErrorLike
): Result<T, InternalError> {
  return Result.err<T, InternalError>(toActionInternalError(action, error));
}

/** Convert an `unknown` catch value into a tagged `InternalError`, using a fallback message for non-Error values. */
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

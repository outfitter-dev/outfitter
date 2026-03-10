/**
 * Argument parsing for the scaffold E2E script.
 *
 * @packageDocumentation
 */

import type { InitPresetId } from "../commands/init-option-resolution.js";
import type { ScaffoldE2EProfileId } from "./config.js";
import { resolveScaffoldE2EProfile } from "./config.js";
import { resolveScaffoldE2EPresets } from "./runner.js";
import { DEFAULT_SCAFFOLD_E2E_RETENTION_MS } from "./workspace.js";

export interface ParsedScaffoldE2EArgs {
  readonly clean: boolean;
  readonly keep: boolean;
  readonly maxAgeMs: number;
  readonly presets: readonly string[] | undefined;
  readonly profile: ScaffoldE2EProfileId;
  readonly rootDir: string | undefined;
}

export function parseScaffoldE2EArgs(
  argv: readonly string[]
): ParsedScaffoldE2EArgs {
  let clean = false;
  let keep = process.env["OUTFITTER_SCAFFOLD_E2E_KEEP"] === "1";
  let rootDir = process.env["OUTFITTER_SCAFFOLD_E2E_ROOT"];
  let maxAgeMs = DEFAULT_SCAFFOLD_E2E_RETENTION_MS;
  let profile: ScaffoldE2EProfileId = "default";
  const presets: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--clean") {
      clean = true;
      continue;
    }

    if (arg === "--ci") {
      profile = "ci";
      continue;
    }

    if (arg === "--keep") {
      keep = true;
      continue;
    }

    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --root");
      }
      rootDir = value;
      index += 1;
      continue;
    }

    if (arg === "--max-age-hours") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --max-age-hours");
      }

      const hours = Number(value);
      if (!Number.isFinite(hours) || hours < 0) {
        throw new Error(`Invalid --max-age-hours value: ${value}`);
      }

      maxAgeMs = hours * 60 * 60 * 1000;
      index += 1;
      continue;
    }

    if (arg === "--preset") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --preset");
      }
      presets.push(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (clean && presets.length > 0) {
    throw new Error("--clean cannot be combined with --preset");
  }

  return {
    clean,
    keep,
    maxAgeMs,
    presets: presets.length > 0 ? presets : undefined,
    profile,
    rootDir,
  };
}

export function resolveScaffoldE2EScriptPlan(args: ParsedScaffoldE2EArgs): {
  readonly presets: readonly InitPresetId[];
  readonly profile: ReturnType<typeof resolveScaffoldE2EProfile>;
} {
  const profile = resolveScaffoldE2EProfile(args.profile);
  const presets = args.presets
    ? resolveScaffoldE2EPresets(args.presets)
    : profile.presets;

  return {
    profile,
    presets,
  };
}

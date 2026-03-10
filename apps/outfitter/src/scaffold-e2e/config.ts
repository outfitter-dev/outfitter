/**
 * Shared scaffold E2E profile configuration.
 *
 * Centralizes preset groups and timeout budgets so manual runs and CI use
 * the same source of truth.
 *
 * @packageDocumentation
 */

import type { InitPresetId } from "../commands/init-option-resolution.js";

export type ScaffoldE2EProfileId = "default" | "ci";

export interface ScaffoldE2EProfile {
  readonly commandTimeoutMs: number;
  readonly id: ScaffoldE2EProfileId;
  readonly presets: readonly InitPresetId[];
}

export const DEFAULT_SCAFFOLD_E2E_PRESETS: readonly InitPresetId[] = [
  "cli",
  "library",
  "full-stack",
  "minimal",
  "mcp",
  "daemon",
] as const;

export const SCAFFOLD_E2E_STEPS_PER_PRESET = 3;

const SCAFFOLD_E2E_PROFILES = {
  default: {
    id: "default",
    presets: DEFAULT_SCAFFOLD_E2E_PRESETS,
    commandTimeoutMs: 240_000,
  },
  // The CI workflow currently runs three presets. At 120s per command and
  // three commands per preset, the total timeout budget is 18 minutes, which
  // comfortably fits inside the 25-minute job timeout.
  ci: {
    id: "ci",
    presets: ["cli", "library", "full-stack"],
    commandTimeoutMs: 120_000,
  },
} as const satisfies Record<ScaffoldE2EProfileId, ScaffoldE2EProfile>;

export function resolveScaffoldE2EProfile(
  id: ScaffoldE2EProfileId = "default"
): ScaffoldE2EProfile {
  return SCAFFOLD_E2E_PROFILES[id];
}

export function getScaffoldE2ESuiteTimeoutBudgetMs(
  profile: ScaffoldE2EProfile
): number {
  return (
    profile.commandTimeoutMs *
    profile.presets.length *
    SCAFFOLD_E2E_STEPS_PER_PRESET
  );
}

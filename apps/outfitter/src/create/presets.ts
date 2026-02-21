import type { CreatePresetDefinition, CreatePresetId } from "./types.js";

export const CREATE_PRESETS: Readonly<
  Record<CreatePresetId, CreatePresetDefinition>
> = {
  basic: {
    id: "basic",
    presetDir: "basic",
    summary: "Minimal Bun + TypeScript project.",
    defaultBlocks: ["scaffolding"],
  },
  cli: {
    id: "cli",
    presetDir: "cli",
    summary: "CLI starter with Outfitter command ergonomics.",
    defaultBlocks: ["scaffolding"],
  },
  daemon: {
    id: "daemon",
    presetDir: "daemon",
    summary: "Daemon + control CLI starter.",
    defaultBlocks: ["scaffolding"],
  },
  mcp: {
    id: "mcp",
    presetDir: "mcp",
    summary: "MCP server starter.",
    defaultBlocks: ["scaffolding"],
  },
} as const;

export const CREATE_PRESET_IDS = Object.keys(
  CREATE_PRESETS
) as CreatePresetId[];

export function getCreatePreset(
  id: string
): CreatePresetDefinition | undefined {
  const presets = CREATE_PRESETS as Record<string, CreatePresetDefinition>;
  return presets[id];
}

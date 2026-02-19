import { booleanFlagPreset, composePresets } from "@outfitter/cli/flags";
import type { Command } from "commander";

const demoRootFlagsPreset = composePresets(
  booleanFlagPreset({
    id: "demo-list",
    key: "list",
    flags: "-l, --list",
    description: "List available demo sections",
  }),
  booleanFlagPreset({
    id: "demo-animate",
    key: "animate",
    flags: "-a, --animate",
    description: "Run animated demo (spinners only)",
  }),
  booleanFlagPreset({
    id: "demo-jsonl",
    key: "jsonl",
    flags: "--jsonl",
    description: "Output as JSONL",
  })
);

export interface DemoRootFlags {
  readonly list: boolean;
  readonly animate: boolean;
  readonly jsonl: boolean;
}

export function applyDemoRootFlags(command: Command): Command {
  for (const option of demoRootFlagsPreset.options) {
    command.option(option.flags, option.description, option.defaultValue);
  }
  return command;
}

export function resolveDemoRootFlags(
  flags: Record<string, unknown>
): DemoRootFlags {
  const resolved = demoRootFlagsPreset.resolve(flags);
  return {
    list: resolved["list"] ?? false,
    animate: resolved["animate"] ?? false,
    jsonl: resolved["jsonl"] ?? false,
  };
}

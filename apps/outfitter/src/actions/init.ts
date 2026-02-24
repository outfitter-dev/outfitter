/**
 * Init action definitions.
 *
 * @packageDocumentation
 */

import { actionCliPresets } from "@outfitter/cli/actions";
import {
  booleanFlagPreset,
  dryRunPreset,
  forcePreset,
} from "@outfitter/cli/flags";
import {
  type ActionCliInputContext,
  type ActionCliOption,
  defineAction,
  InternalError,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import type { InitOptions } from "../commands/init.js";
import { printInitResults, runInit } from "../commands/init.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
} from "../output-mode.js";
import {
  outputModeSchema,
  resolveInstallTimeoutFlag,
  resolveLocalFlag,
  resolveNoToolingFlag,
  resolveStringFlag,
} from "./shared.js";

interface InitFlags {
  readonly bin?: unknown;
  readonly dryRun?: unknown;
  readonly force?: unknown;
  readonly installTimeout?: unknown;
  readonly json?: unknown;
  readonly local?: unknown;
  readonly name?: string | undefined;
  readonly noTooling?: unknown;
  readonly preset?: unknown;
  readonly skipCommit?: unknown;
  readonly skipGit?: unknown;
  readonly skipInstall?: unknown;
  readonly structure?: unknown;
  readonly tooling?: unknown;
  readonly with?: unknown;
  readonly workspace?: unknown;
  readonly workspaceName?: unknown;
  readonly yes?: unknown;
}

interface InitActionInput extends InitOptions {
  outputMode: CliOutputMode;
}

const initPresetValues = [
  "minimal",
  "cli",
  "mcp",
  "daemon",
  "library",
  "full-stack",
  "lib",
] as const;

type InitPresetFlag = (typeof initPresetValues)[number];
type NormalizedInitPreset = Exclude<InitPresetFlag, "lib">;

function normalizeInitPreset(
  preset: InitPresetFlag | undefined
): NormalizedInitPreset | undefined {
  if (preset === undefined) {
    return undefined;
  }

  return preset === "lib" ? "library" : preset;
}

const initInputSchema = z.object({
  targetDir: z.string(),
  name: z.string().optional(),
  bin: z.string().optional(),
  preset: z.enum(initPresetValues).optional(),
  structure: z.enum(["single", "workspace"]).optional(),
  workspaceName: z.string().optional(),
  local: z.boolean().optional(),
  force: z.boolean(),
  with: z.string().optional(),
  noTooling: z.boolean().optional(),
  yes: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  skipInstall: z.boolean().optional(),
  skipGit: z.boolean().optional(),
  skipCommit: z.boolean().optional(),
  installTimeout: z.number().optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<InitActionInput>;

const commonInitOptions: ActionCliOption[] = [
  {
    flags: "-n, --name <name>",
    description: "Package name (defaults to directory name)",
  },
  {
    flags: "-b, --bin <name>",
    description: "Binary name (defaults to project name)",
  },
  {
    flags: "--local",
    description: "Use workspace:* for @outfitter dependencies",
  },
  {
    flags: "--workspace",
    description: "Alias for --local",
  },
  {
    flags: "--with <blocks>",
    description:
      "Tooling to add (comma-separated: scaffolding, claude, linter, lefthook, bootstrap)",
  },
  {
    flags: "--no-tooling",
    description: "Skip tooling setup",
  },
];

const initSharedFlags = actionCliPresets(
  forcePreset(),
  dryRunPreset(),
  booleanFlagPreset({
    id: "initYes",
    key: "yes",
    flags: "-y, --yes",
    description: "Skip prompts and use defaults for missing values",
  })
);

function resolveInitOptions(
  context: ActionCliInputContext,
  presetOverride?: NormalizedInitPreset
): InitActionInput {
  const flags = context.flags as InitFlags;
  const { force, dryRun, yes } = initSharedFlags.resolve(context);
  const targetDir = context.args[0] ?? process.cwd();
  const name = resolveStringFlag(flags.name);
  const bin = resolveStringFlag(flags.bin);
  const preset = normalizeInitPreset(
    presetOverride ??
      (resolveStringFlag(flags.preset) as InitPresetFlag | undefined)
  );
  const structure = resolveStringFlag(flags.structure) as
    | "single"
    | "workspace"
    | undefined;
  const workspaceName = resolveStringFlag(flags.workspaceName);
  const local = resolveLocalFlag(flags);
  const withBlocks = resolveStringFlag(flags.with);
  const noTooling = resolveNoToolingFlag(flags);
  const skipInstall = Boolean(
    flags.skipInstall ?? context.flags["skip-install"]
  );
  const skipGit = Boolean(flags.skipGit ?? context.flags["skip-git"]);
  const skipCommit = Boolean(flags.skipCommit ?? context.flags["skip-commit"]);
  const installTimeout = resolveInstallTimeoutFlag(flags.installTimeout);
  const outputMode = resolveOutputModeFromContext(context.flags);

  return {
    targetDir,
    name,
    ...(preset ? { preset } : {}),
    ...(structure ? { structure } : {}),
    ...(workspaceName ? { workspaceName } : {}),
    force,
    ...(local !== undefined ? { local } : {}),
    ...(withBlocks ? { with: withBlocks } : {}),
    ...(noTooling !== undefined ? { noTooling } : {}),
    ...(bin ? { bin } : {}),
    ...(yes ? { yes } : {}),
    ...(dryRun ? { dryRun } : {}),
    ...(skipInstall ? { skipInstall } : {}),
    ...(skipGit ? { skipGit } : {}),
    ...(skipCommit ? { skipCommit } : {}),
    ...(installTimeout !== undefined ? { installTimeout } : {}),
    outputMode,
  };
}

function createInitAction(options: {
  readonly id: string;
  readonly description: string;
  readonly command: string;
  readonly presetOverride?: NormalizedInitPreset;
  readonly includePresetOption?: boolean;
}) {
  const presetOption: ActionCliOption = {
    flags: "-p, --preset <preset>",
    description:
      "Preset to use (minimal, cli, mcp, daemon, library, full-stack, lib)",
  };

  const initOptions: ActionCliOption[] = [...commonInitOptions];
  initOptions.push(...initSharedFlags.options);
  initOptions.push({
    flags: "-s, --structure <mode>",
    description: "Project structure (single|workspace)",
  });
  initOptions.push({
    flags: "--workspace-name <name>",
    description: "Workspace root package name",
  });
  initOptions.push({
    flags: "--skip-install",
    description: "Skip bun install",
    defaultValue: false,
  });
  initOptions.push({
    flags: "--skip-git",
    description: "Skip git init and initial commit",
    defaultValue: false,
  });
  initOptions.push({
    flags: "--skip-commit",
    description: "Skip initial commit only",
    defaultValue: false,
  });
  initOptions.push({
    flags: "--install-timeout <ms>",
    description: "bun install timeout in milliseconds",
  });

  if (options.includePresetOption) {
    initOptions.push(presetOption);
  }

  return defineAction({
    id: options.id,
    description: options.description,
    surfaces: ["cli"],
    input: initInputSchema,
    cli: {
      group: "init",
      command: options.command,
      description: options.description,
      options: initOptions,
      mapInput: (context) =>
        resolveInitOptions(context, options.presetOverride),
    },
    handler: async (input) => {
      const { outputMode, ...initInput } = input;
      const result = await runInit(initInput);
      if (result.isErr()) {
        return Result.err(
          new InternalError({
            message: result.error.message,
            context: { action: options.id },
          })
        );
      }

      await printInitResults(result.value, { mode: outputMode });

      return Result.ok(result.value);
    },
  });
}

export const createAction = defineAction({
  id: "create",
  description: "Removed - use 'outfitter init' instead",
  surfaces: ["cli"],
  input: z.object({}).passthrough(),
  cli: {
    command: "create [directory]",
    description: "Removed - use 'outfitter init' instead",
    options: [],
    mapInput: () => ({}),
  },
  handler: async () =>
    Result.err(
      new InternalError({
        message: [
          "The 'create' command has been removed.",
          "",
          "Use 'outfitter init' instead. It supports everything 'create' did:",
          "",
          "  Interactive mode:    outfitter init my-project",
          "  With preset:         outfitter init my-project --preset cli",
          "  Skip prompts:        outfitter init my-project --preset cli --yes",
          "  Workspace:           outfitter init my-project --preset cli --structure workspace",
          "",
          "See 'outfitter init --help' for full options.",
        ].join("\n"),
        context: { action: "create" },
      })
    ),
});

export const initAction = createInitAction({
  id: "init",
  description: "Create a new Outfitter project",
  command: "[directory]",
  includePresetOption: true,
});

export const initCliAction = createInitAction({
  id: "init.cli",
  description: "Create a new CLI project",
  command: "cli [directory]",
  presetOverride: "cli",
});

export const initMcpAction = createInitAction({
  id: "init.mcp",
  description: "Create a new MCP server",
  command: "mcp [directory]",
  presetOverride: "mcp",
});

export const initDaemonAction = createInitAction({
  id: "init.daemon",
  description: "Create a new daemon project",
  command: "daemon [directory]",
  presetOverride: "daemon",
});

export const initLibraryAction = createInitAction({
  id: "init.library",
  description: "Create a new library project",
  command: "library [directory]",
  presetOverride: "library",
});

export const initFullStackAction = createInitAction({
  id: "init.full-stack",
  description: "Create a full-stack workspace",
  command: "full-stack [directory]",
  presetOverride: "full-stack",
});

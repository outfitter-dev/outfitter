/**
 * Action registry for Outfitter CLI.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import { output } from "@outfitter/cli";
import { actionCliPresets } from "@outfitter/cli/actions";
import {
  booleanFlagPreset,
  cwdPreset,
  dryRunPreset,
  forcePreset,
  interactionPreset,
  verbosePreset,
} from "@outfitter/cli/flags";
import { jqPreset, outputModePreset } from "@outfitter/cli/query";
import {
  type ActionCliInputContext,
  type ActionCliOption,
  type ActionRegistry,
  createActionRegistry,
  defineAction,
  InternalError,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import type { TsDocCheckResult } from "@outfitter/tooling";
import { z } from "zod";
import {
  type AddInput,
  listBlocks,
  printAddResults,
  runAdd,
} from "./commands/add.js";
import { printCheckResults, runCheck } from "./commands/check.js";
import { runCheckTsdoc } from "./commands/check-tsdoc.js";
import { runDemo } from "./commands/demo.js";
import {
  type DocsExportInput,
  type DocsExportTarget,
  printDocsExportResults,
  runDocsExport,
} from "./commands/docs-export.js";
import {
  type DocsListInput,
  printDocsListResults,
  runDocsList,
} from "./commands/docs-list.js";
import {
  type DocsSearchInput,
  printDocsSearchResults,
  runDocsSearch,
} from "./commands/docs-search.js";
import {
  type DocsShowInput,
  printDocsShowResults,
  runDocsShow,
} from "./commands/docs-show.js";
import { printDoctorResults, runDoctor } from "./commands/doctor.js";
import type { InitOptions } from "./commands/init.js";
import { printInitResults, runInit } from "./commands/init.js";
import { printScaffoldResults, runScaffold } from "./commands/scaffold.js";
import { printUpgradeResults, runUpgrade } from "./commands/upgrade.js";
import {
  type CliOutputMode,
  resolveOutputModeFromContext,
  resolveStructuredOutputMode,
} from "./output-mode.js";

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

interface ScaffoldFlags {
  readonly dryRun?: unknown;
  readonly force?: unknown;
  readonly installTimeout?: unknown;
  readonly local?: unknown;
  readonly noTooling?: unknown;
  readonly skipInstall?: unknown;
  readonly with?: unknown;
}

interface InitActionInput extends InitOptions {
  outputMode: CliOutputMode;
}
const outputModeSchema = z.enum(["human", "json", "jsonl"]).default("human");

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

interface ScaffoldActionInput {
  cwd: string;
  dryRun: boolean;
  force: boolean;
  installTimeout?: number | undefined;
  local?: boolean | undefined;
  name?: string | undefined;
  noTooling?: boolean | undefined;
  outputMode: CliOutputMode;
  skipInstall: boolean;
  target: string;
  with?: string | undefined;
}

const scaffoldInputSchema = z.object({
  target: z.string(),
  name: z.string().optional(),
  force: z.boolean(),
  skipInstall: z.boolean(),
  dryRun: z.boolean(),
  with: z.string().optional(),
  noTooling: z.boolean().optional(),
  local: z.boolean().optional(),
  installTimeout: z.number().optional(),
  cwd: z.string(),
  outputMode: outputModeSchema,
}) as z.ZodType<ScaffoldActionInput>;

interface DoctorActionInput {
  cwd: string;
  outputMode: CliOutputMode;
}
const doctorInputSchema = z.object({
  cwd: z.string(),
  outputMode: outputModeSchema,
}) as z.ZodType<DoctorActionInput>;

function resolveStringFlag(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveNoToolingFlag(flags: {
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

function resolveLocalFlag(flags: {
  readonly local?: unknown;
  readonly workspace?: unknown;
}): boolean | undefined {
  if (flags.local === true || flags.workspace === true) {
    return true;
  }

  return undefined;
}

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
  const installTimeoutValue = flags.installTimeout;
  let installTimeout: number | undefined;
  if (typeof installTimeoutValue === "string") {
    installTimeout = Number.parseInt(installTimeoutValue, 10);
  } else if (typeof installTimeoutValue === "number") {
    installTimeout = installTimeoutValue;
  }
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

function resolveScaffoldOptions(
  context: ActionCliInputContext
): ScaffoldActionInput {
  const flags = context.flags as ScaffoldFlags;
  const { force, dryRun } = scaffoldSharedFlags.resolve(context);
  const outputMode = resolveOutputModeFromContext(context.flags);
  const noTooling = resolveNoToolingFlag(flags);
  const local = resolveLocalFlag(flags);
  const installTimeoutValue = flags.installTimeout;
  let installTimeout: number | undefined;
  if (typeof installTimeoutValue === "string") {
    installTimeout = Number.parseInt(installTimeoutValue, 10);
  } else if (typeof installTimeoutValue === "number") {
    installTimeout = installTimeoutValue;
  }

  return {
    target: String(context.args[0] ?? ""),
    name: resolveStringFlag(context.args[1]),
    force,
    skipInstall: Boolean(flags.skipInstall ?? context.flags["skip-install"]),
    dryRun,
    ...(local !== undefined ? { local } : {}),
    with: resolveStringFlag(flags.with),
    ...(noTooling !== undefined ? { noTooling } : {}),
    ...(installTimeout !== undefined ? { installTimeout } : {}),
    cwd: process.cwd(),
    outputMode,
  };
}

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
      "Tooling to add (comma-separated: scaffolding, claude, biome, lefthook, bootstrap)",
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

const scaffoldSharedFlags = actionCliPresets(forcePreset(), dryRunPreset());
const addSharedFlags = actionCliPresets(forcePreset(), dryRunPreset());
const createAction = defineAction({
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
        ].join("\\n"),
        context: { action: "create" },
      })
    ),
});

const scaffoldAction = defineAction({
  id: "scaffold",
  description: "Add a capability to an existing project",
  surfaces: ["cli"],
  input: scaffoldInputSchema,
  cli: {
    command: "scaffold <target> [name]",
    description:
      "Add a capability (cli, mcp, daemon, lib, ...) to an existing project",
    options: [
      ...scaffoldSharedFlags.options,
      {
        flags: "--skip-install",
        description: "Skip bun install",
        defaultValue: false,
      },
      {
        flags: "--with <blocks>",
        description: "Comma-separated tooling blocks to add",
      },
      {
        flags: "--no-tooling",
        description: "Skip default tooling blocks",
      },
      {
        flags: "--local",
        description: "Use workspace:* for @outfitter dependencies",
      },
      {
        flags: "--install-timeout <ms>",
        description: "bun install timeout in milliseconds",
      },
    ],
    mapInput: resolveScaffoldOptions,
  },
  handler: async (input) => {
    const { outputMode, ...scaffoldInput } = input;
    const result = await runScaffold(scaffoldInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "scaffold" },
        })
      );
    }

    await printScaffoldResults(result.value, { mode: outputMode });
    return Result.ok(result.value);
  },
});

const demoInputSchema = z.object({
  section: z.string().optional(),
  list: z.boolean().optional(),
  animate: z.boolean().optional(),
  outputMode: outputModeSchema,
});

const demoAction = defineAction({
  id: "demo",
  description: "Run the CLI demo app",
  surfaces: ["cli"],
  input: demoInputSchema,
  cli: {
    command: "demo [section]",
    description: "Run the CLI demo app",
    options: [
      {
        flags: "-l, --list",
        description: "List available demo sections",
        defaultValue: false,
      },
      {
        flags: "-a, --animate",
        description: "Run animated demo (spinners only)",
        defaultValue: false,
      },
    ],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      return {
        section: context.args[0] as string | undefined,
        list: Boolean(context.flags["list"]),
        animate: Boolean(context.flags["animate"]),
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...demoInput } = input;
    try {
      const result = await runDemo({ ...demoInput, outputMode });
      if (result.exitCode !== 0) {
        process.exit(result.exitCode);
      }
      return Result.ok(result);
    } catch (error) {
      return Result.err(
        new InternalError({
          message:
            error instanceof Error ? error.message : "Failed to run demo",
          context: { action: "demo" },
        })
      );
    }
  },
});

const doctorCwd = cwdPreset();

const doctorAction = defineAction({
  id: "doctor",
  description: "Validate environment and dependencies",
  surfaces: ["cli"],
  input: doctorInputSchema,
  cli: {
    command: "doctor",
    description: "Validate environment and dependencies",
    options: [...doctorCwd.options],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      const { cwd: rawCwd } = doctorCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      return {
        cwd,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...doctorInput } = input;
    const result = await runDoctor(doctorInput);
    await printDoctorResults(result, { mode: outputMode });

    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }

    return Result.ok(result);
  },
});

const addInputSchema = z.object({
  block: z.string(),
  force: z.boolean(),
  dryRun: z.boolean(),
  cwd: z.string().optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<AddInput & { outputMode: CliOutputMode }>;

const addCwd = cwdPreset();

const addAction = defineAction({
  id: "add",
  description: "Add a block from the registry to your project",
  surfaces: ["cli"],
  input: addInputSchema,
  cli: {
    group: "add",
    command: "<block>",
    description:
      "Add a block from the registry (claude, biome, lefthook, bootstrap, scaffolding)",
    options: [...addSharedFlags.options, ...addCwd.options],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      const { force, dryRun } = addSharedFlags.resolve(context);
      const { cwd: rawCwd } = addCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      return {
        block: context.args[0] as string,
        force,
        dryRun,
        cwd,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...addInput } = input;
    const result = await runAdd(addInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "add" },
        })
      );
    }

    await printAddResults(result.value, addInput.dryRun, { mode: outputMode });
    return Result.ok(result.value);
  },
});

const listBlocksAction = defineAction({
  id: "add.list",
  description: "List available blocks",
  surfaces: ["cli"],
  input: z.object({ outputMode: outputModeSchema }) as z.ZodType<{
    outputMode: CliOutputMode;
  }>,
  cli: {
    group: "add",
    command: "list",
    description: "List available blocks",
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      return {
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const result = listBlocks();

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "add.list" },
        })
      );
    }

    const structuredMode = resolveStructuredOutputMode(input.outputMode);
    if (structuredMode) {
      await output({ blocks: result.value }, { mode: structuredMode });
    } else {
      const lines = [
        "Available blocks:",
        ...result.value.map((block) => `  - ${block}`),
      ];
      await output(lines, { mode: "human" });
    }

    return Result.ok({ blocks: result.value });
  },
});

interface CheckActionInput {
  block?: string;
  cwd: string;
  outputMode: CliOutputMode;
  verbose: boolean;
}

const checkInputSchema = z.object({
  cwd: z.string(),
  verbose: z.boolean(),
  block: z.string().optional(),
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

const checkAction = defineAction({
  id: "check",
  description:
    "Compare local config blocks against the registry for drift detection",
  surfaces: ["cli"],
  input: checkInputSchema,
  cli: {
    group: "check",
    // No `command` — this IS the base "check" command. Omitting `command`
    // prevents schema from rendering "check check".
    description:
      "Compare local config blocks against the registry for drift detection",
    options: [
      ...checkVerboseOptions,
      {
        flags: "-b, --block <name>",
        description: "Check a specific block only",
      },
      {
        flags: "--ci",
        description: "Deprecated: use --output json instead",
        defaultValue: false,
      },
      ...checkOutputMode.options,
      ...checkCwd.options,
    ],
    mapInput: (context) => {
      const { outputMode: presetOutputMode } = checkOutputMode.resolve(
        context.flags
      );
      const explicitOutput = typeof context.flags["output"] === "string";
      let outputMode: CliOutputMode;
      if (explicitOutput) {
        // Explicit --output should always win over env fallbacks.
        outputMode = resolveStructuredOutputMode(presetOutputMode) ?? "human";
      } else if (context.flags["ci"]) {
        // Deprecated --ci alias
        outputMode = "json";
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
      const block = resolveStringFlag(context.flags["block"]);
      return {
        cwd,
        verbose,
        ...(block !== undefined ? { block } : {}),
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...checkInput } = input;
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

const checkTsdocOutputSchema = z.object({
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

const checkTsdocAction = defineAction<
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

interface UpgradeActionInput {
  all: boolean;
  cwd: string;
  dryRun: boolean;
  guide: boolean;
  guidePackages?: string[];
  interactive: boolean;
  noCodemods: boolean;
  outputMode: CliOutputMode;
  yes: boolean;
}

const upgradeInputSchema = z.object({
  cwd: z.string(),
  guide: z.boolean(),
  guidePackages: z.array(z.string()).optional(),
  dryRun: z.boolean(),
  yes: z.boolean(),
  interactive: z.boolean(),
  all: z.boolean(),
  noCodemods: z.boolean(),
  outputMode: outputModeSchema,
}) as z.ZodType<UpgradeActionInput>;

const upgradeCwd = cwdPreset();
const upgradeDryRun = dryRunPreset();
const upgradeInteraction = interactionPreset();
const upgradeAll = booleanFlagPreset({
  id: "upgradeAll",
  key: "all",
  flags: "--all",
  description: "Include breaking changes in the upgrade",
});
const upgradeNoCodemods = booleanFlagPreset({
  id: "upgradeNoCodemods",
  key: "noCodemods",
  flags: "--no-codemods",
  description: "Skip automatic codemod execution during upgrade",
  sources: ["noCodemods", "no-codemods"],
  negatedSources: ["codemods"],
});
const upgradeGuide = booleanFlagPreset({
  id: "upgradeGuide",
  key: "guide",
  flags: "--guide",
  description:
    "Show migration instructions for available updates. Pass package names to filter.",
});
const upgradeFlags = actionCliPresets(
  upgradeCwd,
  upgradeDryRun,
  upgradeInteraction,
  upgradeAll,
  upgradeNoCodemods,
  upgradeGuide
);

const upgradeAction = defineAction({
  id: "upgrade",
  description: "Check for @outfitter/* package updates and migration guidance",
  surfaces: ["cli"],
  input: upgradeInputSchema,
  cli: {
    command: "upgrade [packages...]",
    description:
      "Check for @outfitter/* package updates and migration guidance",
    options: [...upgradeFlags.options],
    mapInput: (context) => {
      const outputMode = resolveOutputModeFromContext(context.flags);
      const {
        cwd: rawCwd,
        dryRun,
        interactive,
        yes,
        all,
        noCodemods,
        guide,
      } = upgradeFlags.resolve(context);
      const cwd = resolve(process.cwd(), rawCwd);
      const guidePackages =
        context.args.length > 0 ? (context.args as string[]) : undefined;
      return {
        cwd,
        guide,
        ...(guidePackages !== undefined ? { guidePackages } : {}),
        dryRun,
        yes,
        interactive,
        all,
        noCodemods,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, guidePackages, ...upgradeInput } = input;
    const result = await runUpgrade({
      ...upgradeInput,
      outputMode,
      ...(guidePackages !== undefined ? { guidePackages } : {}),
    });

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "upgrade" },
        })
      );
    }

    await printUpgradeResults(result.value, {
      mode: outputMode,
      guide: upgradeInput.guide,
      cwd: upgradeInput.cwd,
      dryRun: upgradeInput.dryRun,
      all: upgradeInput.all,
    });

    return Result.ok(result.value);
  },
});

// ---------------------------------------------------------------------------
// docs.list action
// ---------------------------------------------------------------------------

const docsListInputSchema = z.object({
  cwd: z.string(),
  kind: z.string().optional(),
  package: z.string().optional(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<DocsListInput>;

const docsListCwd = cwdPreset();
const docsListOutputMode = outputModePreset({ includeJsonl: true });
const docsListJq = jqPreset();

const docsListAction = defineAction({
  id: "docs.list",
  description: "List documentation entries from the docs map",
  surfaces: ["cli"],
  input: docsListInputSchema,
  cli: {
    group: "docs",
    command: "list",
    description: "List documentation entries from the docs map",
    options: [
      {
        flags: "-k, --kind <kind>",
        description:
          "Filter by doc kind (readme, guide, reference, architecture, release, convention, deep, generated)",
      },
      {
        flags: "-p, --package <name>",
        description: "Filter by package name",
      },
      ...docsListOutputMode.options,
      ...docsListJq.options,
      ...docsListCwd.options,
    ],
    mapInput: (context) => {
      const { outputMode: presetOutputMode } = docsListOutputMode.resolve(
        context.flags
      );
      const { jq } = docsListJq.resolve(context.flags);
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
      const { cwd: rawCwd } = docsListCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      const kind = resolveStringFlag(context.flags["kind"]);
      const pkg = resolveStringFlag(context.flags["package"]);

      return {
        cwd,
        outputMode,
        jq,
        ...(kind !== undefined ? { kind } : {}),
        ...(pkg !== undefined ? { package: pkg } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, jq } = input;
    const result = await runDocsList(input);

    if (result.isErr()) {
      return result;
    }

    await printDocsListResults(result.value, { mode: outputMode, jq });
    return Result.ok(result.value);
  },
});

// ---------------------------------------------------------------------------
// docs.show action
// ---------------------------------------------------------------------------

const docsShowInputSchema = z.object({
  id: z.string(),
  cwd: z.string(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<DocsShowInput>;

const docsShowCwd = cwdPreset();
const docsShowOutputMode = outputModePreset({ includeJsonl: true });
const docsShowJq = jqPreset();

const docsShowAction = defineAction({
  id: "docs.show",
  description: "Show a specific documentation entry and its content",
  surfaces: ["cli"],
  input: docsShowInputSchema,
  cli: {
    group: "docs",
    command: "show <id>",
    description: "Show a specific documentation entry and its content",
    options: [
      ...docsShowOutputMode.options,
      ...docsShowJq.options,
      ...docsShowCwd.options,
    ],
    mapInput: (context) => {
      const { outputMode: presetOutputMode } = docsShowOutputMode.resolve(
        context.flags
      );
      const { jq } = docsShowJq.resolve(context.flags);
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
      const { cwd: rawCwd } = docsShowCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);

      return {
        id: context.args[0] as string,
        cwd,
        jq,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, jq } = input;
    const result = await runDocsShow(input);

    if (result.isErr()) {
      return result;
    }

    await printDocsShowResults(result.value, { mode: outputMode, jq });
    return Result.ok(result.value);
  },
});

// ---------------------------------------------------------------------------
// docs.search action
// ---------------------------------------------------------------------------

const docsSearchInputSchema = z.object({
  query: z.string(),
  cwd: z.string(),
  kind: z.string().optional(),
  package: z.string().optional(),
  jq: z.string().optional(),
  outputMode: outputModeSchema,
}) as z.ZodType<DocsSearchInput>;

const docsSearchCwd = cwdPreset();
const docsSearchOutputMode = outputModePreset({ includeJsonl: true });
const docsSearchJq = jqPreset();

const docsSearchAction = defineAction({
  id: "docs.search",
  description: "Search documentation content for a query string",
  surfaces: ["cli"],
  input: docsSearchInputSchema,
  cli: {
    group: "docs",
    command: "search <query>",
    description: "Search documentation content for a query string",
    options: [
      {
        flags: "-k, --kind <kind>",
        description:
          "Filter by doc kind (readme, guide, reference, architecture, release, convention, deep, generated)",
      },
      {
        flags: "-p, --package <name>",
        description: "Filter by package name",
      },
      ...docsSearchOutputMode.options,
      ...docsSearchJq.options,
      ...docsSearchCwd.options,
    ],
    mapInput: (context) => {
      const { outputMode: presetOutputMode } = docsSearchOutputMode.resolve(
        context.flags
      );
      const { jq } = docsSearchJq.resolve(context.flags);
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
      const { cwd: rawCwd } = docsSearchCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      const kind = resolveStringFlag(context.flags["kind"]);
      const pkg = resolveStringFlag(context.flags["package"]);

      return {
        query: context.args[0] as string,
        cwd,
        outputMode,
        jq,
        ...(kind !== undefined ? { kind } : {}),
        ...(pkg !== undefined ? { package: pkg } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, jq, ...searchInput } = input;
    const result = await runDocsSearch({ ...searchInput, outputMode, jq });

    if (result.isErr()) {
      return result;
    }

    await printDocsSearchResults(result.value, { mode: outputMode, jq });
    return Result.ok(result.value);
  },
});

// ---------------------------------------------------------------------------
// docs.export action
// ---------------------------------------------------------------------------

const docsExportTargetValues = [
  "packages",
  "llms",
  "llms-full",
  "all",
] as const;

const docsExportInputSchema = z.object({
  cwd: z.string(),
  target: z.enum(docsExportTargetValues).default("all"),
  outputMode: outputModeSchema,
}) as z.ZodType<DocsExportInput>;

const docsExportCwd = cwdPreset();
const docsExportOutputMode = outputModePreset({ includeJsonl: true });

const docsExportAction = defineAction({
  id: "docs.export",
  description: "Export documentation to packages, llms.txt, or both",
  surfaces: ["cli"],
  input: docsExportInputSchema,
  cli: {
    group: "docs",
    command: "export",
    description: "Export documentation to packages, llms.txt, or both",
    options: [
      {
        flags: "-t, --target <target>",
        description:
          "Export target (packages|llms|llms-full|all, default: all)",
      },
      ...docsExportOutputMode.options,
      ...docsExportCwd.options,
    ],
    mapInput: (context) => {
      const { outputMode: presetOutputMode } = docsExportOutputMode.resolve(
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
      const { cwd: rawCwd } = docsExportCwd.resolve(context.flags);
      const cwd = resolve(process.cwd(), rawCwd);
      const targetRaw = resolveStringFlag(context.flags["target"]);
      const target = (targetRaw ?? "all") as DocsExportTarget;

      return {
        cwd,
        target,
        outputMode,
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...exportInput } = input;
    const result = await runDocsExport({ ...exportInput, outputMode });

    if (result.isErr()) {
      return result;
    }

    await printDocsExportResults(result.value, { mode: outputMode });
    return Result.ok(result.value);
  },
});

export const outfitterActions: ActionRegistry = createActionRegistry()
  .add(createAction)
  .add(scaffoldAction)
  .add(
    createInitAction({
      id: "init",
      description: "Create a new Outfitter project",
      command: "[directory]",
      includePresetOption: true,
    })
  )
  .add(
    createInitAction({
      id: "init.cli",
      description: "Create a new CLI project",
      command: "cli [directory]",
      presetOverride: "cli",
    })
  )
  .add(
    createInitAction({
      id: "init.mcp",
      description: "Create a new MCP server",
      command: "mcp [directory]",
      presetOverride: "mcp",
    })
  )
  .add(
    createInitAction({
      id: "init.daemon",
      description: "Create a new daemon project",
      command: "daemon [directory]",
      presetOverride: "daemon",
    })
  )
  .add(
    createInitAction({
      id: "init.library",
      description: "Create a new library project",
      command: "library [directory]",
      presetOverride: "library",
    })
  )
  .add(
    createInitAction({
      id: "init.full-stack",
      description: "Create a full-stack workspace",
      command: "full-stack [directory]",
      presetOverride: "full-stack",
    })
  )
  .add(demoAction)
  .add(doctorAction)
  .add(addAction)
  .add(listBlocksAction)
  .add(checkAction)
  .add(checkTsdocAction)
  .add(upgradeAction)
  .add(docsListAction)
  .add(docsShowAction)
  .add(docsSearchAction)
  .add(docsExportAction);

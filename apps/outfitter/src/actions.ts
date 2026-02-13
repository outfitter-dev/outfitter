/**
 * Action registry for Outfitter CLI.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import { output } from "@outfitter/cli/output";
import type { OutputMode } from "@outfitter/cli/types";
import {
  type ActionCliInputContext,
  type ActionCliOption,
  type ActionRegistry,
  createActionRegistry,
  defineAction,
  InternalError,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import {
  type AddInput,
  listBlocks,
  printAddResults,
  runAdd,
} from "./commands/add.js";
import { printCheckResults, runCheck } from "./commands/check.js";
import { printDemoResults, runDemo } from "./commands/demo.js";
import { printDoctorResults, runDoctor } from "./commands/doctor.js";
import type { InitOptions } from "./commands/init.js";
import { printInitResults, runInit } from "./commands/init.js";
import {
  printMigrateKitResults,
  runMigrateKit,
} from "./commands/migrate-kit.js";
import { printScaffoldResults, runScaffold } from "./commands/scaffold.js";
import { printUpdateResults, runUpdate } from "./commands/update.js";
import { resolveStructuredOutputMode } from "./output-mode.js";

interface InitFlags {
  readonly name?: string | undefined;
  readonly bin?: unknown;
  readonly preset?: unknown;
  readonly template?: unknown;
  readonly structure?: unknown;
  readonly workspaceName?: unknown;
  readonly force?: unknown;
  readonly local?: unknown;
  readonly workspace?: unknown;
  readonly with?: unknown;
  readonly noTooling?: unknown;
  readonly tooling?: unknown;
  readonly yes?: unknown;
  readonly dryRun?: unknown;
  readonly skipInstall?: unknown;
  readonly skipGit?: unknown;
  readonly skipCommit?: unknown;
  readonly installTimeout?: unknown;
  readonly json?: unknown;
}

interface ScaffoldFlags {
  readonly force?: unknown;
  readonly skipInstall?: unknown;
  readonly dryRun?: unknown;
  readonly with?: unknown;
  readonly noTooling?: unknown;
  readonly local?: unknown;
  readonly installTimeout?: unknown;
}

interface MigrateFlags {
  readonly dryRun?: unknown;
  readonly json?: unknown;
}

interface InitActionInput extends InitOptions {
  outputMode?: OutputMode;
}
const outputModeSchema = z.enum(["human", "json", "jsonl"]).optional();

const initInputSchema = z.object({
  targetDir: z.string(),
  name: z.string().optional(),
  bin: z.string().optional(),
  preset: z.enum(["minimal", "cli", "mcp", "daemon"]).optional(),
  template: z.string().optional(),
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
  target: string;
  name?: string | undefined;
  force: boolean;
  skipInstall: boolean;
  dryRun: boolean;
  with?: string | undefined;
  noTooling?: boolean | undefined;
  local?: boolean | undefined;
  installTimeout?: number | undefined;
  cwd: string;
  outputMode?: OutputMode;
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

interface MigrateKitActionInput {
  targetDir: string;
  dryRun: boolean;
  outputMode?: OutputMode;
}

const migrateKitInputSchema = z.object({
  targetDir: z.string(),
  dryRun: z.boolean(),
  outputMode: outputModeSchema,
}) as z.ZodType<MigrateKitActionInput>;

interface DoctorActionInput {
  cwd: string;
  outputMode?: OutputMode;
}
const doctorInputSchema = z.object({
  cwd: z.string(),
  outputMode: outputModeSchema,
}) as z.ZodType<DoctorActionInput>;

function resolveStringFlag(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveOutputMode(
  flags: Record<string, unknown>
): OutputMode | undefined {
  if (flags["json"]) {
    process.env["OUTFITTER_JSON"] = "1";
    return "json";
  }
  return undefined;
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
  presetOverride?: "minimal" | "cli" | "mcp" | "daemon"
): InitActionInput {
  const flags = context.flags as InitFlags;
  const targetDir = context.args[0] ?? process.cwd();
  const name = resolveStringFlag(flags.name);
  const bin = resolveStringFlag(flags.bin);
  const preset =
    presetOverride ??
    (resolveStringFlag(flags.preset) as
      | "minimal"
      | "cli"
      | "mcp"
      | "daemon"
      | undefined);
  const template = resolveStringFlag(flags.template);
  const structure = resolveStringFlag(flags.structure) as
    | "single"
    | "workspace"
    | undefined;
  const workspaceName = resolveStringFlag(flags.workspaceName);
  const local = resolveLocalFlag(flags);
  const force = Boolean(flags.force);
  const withBlocks = resolveStringFlag(flags.with);
  const noTooling = resolveNoToolingFlag(flags);
  const yes = Boolean(flags.yes);
  const dryRun = Boolean(flags.dryRun ?? context.flags["dry-run"]);
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
  const outputMode = resolveOutputMode(context.flags);

  return {
    targetDir,
    name,
    ...(preset ? { preset } : {}),
    ...(template ? { template } : {}),
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
    ...(outputMode ? { outputMode } : {}),
  };
}

function resolveScaffoldOptions(
  context: ActionCliInputContext
): ScaffoldActionInput {
  const flags = context.flags as ScaffoldFlags;
  const outputMode = resolveOutputMode(context.flags);
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
    force: Boolean(flags.force),
    skipInstall: Boolean(flags.skipInstall ?? context.flags["skip-install"]),
    dryRun: Boolean(flags.dryRun ?? context.flags["dry-run"]),
    ...(local !== undefined ? { local } : {}),
    with: resolveStringFlag(flags.with),
    ...(noTooling !== undefined ? { noTooling } : {}),
    ...(installTimeout !== undefined ? { installTimeout } : {}),
    cwd: process.cwd(),
    ...(outputMode ? { outputMode } : {}),
  };
}

function resolveMigrateKitOptions(
  context: ActionCliInputContext
): MigrateKitActionInput {
  const flags = context.flags as MigrateFlags;
  const outputMode = resolveOutputMode(context.flags);

  return {
    targetDir: context.args[0] ?? process.cwd(),
    dryRun: Boolean(flags.dryRun || context.flags["dry-run"]),
    ...(outputMode ? { outputMode } : {}),
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
    flags: "-f, --force",
    description: "Overwrite existing files",
    defaultValue: false,
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

const templateOption: ActionCliOption = {
  flags: "-t, --template <template>",
  description: "Template to use (deprecated, use --preset)",
};

function createInitAction(options: {
  readonly id: string;
  readonly description: string;
  readonly command: string;
  readonly presetOverride?: "minimal" | "cli" | "mcp" | "daemon";
  readonly includePresetOption?: boolean;
  readonly includeTemplateOption?: boolean;
}) {
  const presetOption: ActionCliOption = {
    flags: "-p, --preset <preset>",
    description: "Preset to use (minimal, cli, mcp, daemon)",
  };

  const initOptions: ActionCliOption[] = [...commonInitOptions];
  initOptions.push({
    flags: "-s, --structure <mode>",
    description: "Project structure (single|workspace)",
  });
  initOptions.push({
    flags: "--workspace-name <name>",
    description: "Workspace root package name",
  });
  initOptions.push({
    flags: "-y, --yes",
    description: "Skip prompts and use defaults for missing values",
    defaultValue: false,
  });
  initOptions.push({
    flags: "--dry-run",
    description: "Preview changes without writing files",
    defaultValue: false,
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
  if (options.includeTemplateOption) {
    initOptions.push(templateOption);
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
      const outputOptions = outputMode ? { mode: outputMode } : undefined;
      const result = await runInit(initInput);
      if (result.isErr()) {
        return Result.err(
          new InternalError({
            message: result.error.message,
            context: { action: options.id },
          })
        );
      }

      await printInitResults(result.value, outputOptions);

      return Result.ok(result.value);
    },
  });
}

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
      {
        flags: "-f, --force",
        description: "Overwrite existing files",
        defaultValue: false,
      },
      {
        flags: "--skip-install",
        description: "Skip bun install",
        defaultValue: false,
      },
      {
        flags: "--dry-run",
        description: "Preview changes without executing",
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
    const outputOptions = outputMode ? { mode: outputMode } : undefined;
    const result = await runScaffold(scaffoldInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "scaffold" },
        })
      );
    }

    await printScaffoldResults(result.value, outputOptions);
    return Result.ok(result.value);
  },
});

const demoInputSchema = z.object({
  section: z.string().optional(),
  list: z.boolean().optional(),
  animate: z.boolean().optional(),
});

const demoAction = defineAction({
  id: "demo",
  description: "Showcase @outfitter/cli rendering capabilities",
  surfaces: ["cli"],
  input: demoInputSchema,
  cli: {
    command: "demo [section]",
    description: "Showcase @outfitter/cli rendering capabilities",
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
      // Consume --json so it's not silently ignored
      resolveOutputMode(context.flags);
      return {
        section: context.args[0] as string | undefined,
        list: Boolean(context.flags["list"]),
        animate: Boolean(context.flags["animate"]),
      };
    },
  },
  handler: async (input) => {
    const result = await runDemo(input);
    await printDemoResults(result);

    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }

    return Result.ok(result);
  },
});

const doctorAction = defineAction({
  id: "doctor",
  description: "Validate environment and dependencies",
  surfaces: ["cli"],
  input: doctorInputSchema,
  cli: {
    command: "doctor",
    description: "Validate environment and dependencies",
    mapInput: (context) => {
      const outputMode = resolveOutputMode(context.flags);
      return {
        cwd: process.cwd(),
        ...(outputMode ? { outputMode } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...doctorInput } = input;
    const outputOptions = outputMode ? { mode: outputMode } : undefined;
    const result = await runDoctor(doctorInput);
    await printDoctorResults(result, outputOptions);

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
}) as z.ZodType<AddInput & { outputMode?: OutputMode }>;

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
    options: [
      {
        flags: "-f, --force",
        description: "Overwrite existing files",
        defaultValue: false,
      },
      {
        flags: "--dry-run",
        description: "Show what would be added without making changes",
        defaultValue: false,
      },
    ],
    mapInput: (context) => {
      const outputMode = resolveOutputMode(context.flags);
      return {
        block: context.args[0] as string,
        force: Boolean(context.flags["force"]),
        dryRun: Boolean(context.flags["dry-run"] ?? context.flags["dryRun"]),
        cwd: process.cwd(),
        ...(outputMode ? { outputMode } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...addInput } = input;
    const outputOptions = outputMode ? { mode: outputMode } : undefined;
    const result = await runAdd(addInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "add" },
        })
      );
    }

    await printAddResults(result.value, addInput.dryRun, outputOptions);
    return Result.ok(result.value);
  },
});

const listBlocksAction = defineAction({
  id: "add.list",
  description: "List available blocks",
  surfaces: ["cli"],
  input: z.object({ outputMode: outputModeSchema }) as z.ZodType<{
    outputMode?: OutputMode;
  }>,
  cli: {
    group: "add",
    command: "list",
    description: "List available blocks",
    mapInput: (context) => {
      const outputMode = resolveOutputMode(context.flags);
      return {
        ...(outputMode ? { outputMode } : {}),
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
      await output(lines);
    }

    return Result.ok({ blocks: result.value });
  },
});

interface CheckActionInput {
  cwd: string;
  verbose: boolean;
  block?: string;
  ci: boolean;
  outputMode?: OutputMode;
}

const checkInputSchema = z.object({
  cwd: z.string(),
  verbose: z.boolean(),
  block: z.string().optional(),
  ci: z.boolean(),
  outputMode: outputModeSchema,
}) as z.ZodType<CheckActionInput>;

const checkAction = defineAction({
  id: "check",
  description:
    "Compare local config blocks against the registry for drift detection",
  surfaces: ["cli"],
  input: checkInputSchema,
  cli: {
    command: "check",
    description:
      "Compare local config blocks against the registry for drift detection",
    options: [
      {
        flags: "-v, --verbose",
        description: "Show diffs for drifted files",
        defaultValue: false,
      },
      {
        flags: "-b, --block <name>",
        description: "Check a specific block only",
      },
      {
        flags: "--ci",
        description: "Machine-oriented output for CI",
        defaultValue: false,
      },
      {
        flags: "--cwd <path>",
        description: "Working directory (defaults to current directory)",
      },
    ],
    mapInput: (context) => {
      const outputMode = resolveOutputMode(context.flags);
      const cwd =
        typeof context.flags["cwd"] === "string"
          ? resolve(process.cwd(), context.flags["cwd"])
          : process.cwd();
      const block = resolveStringFlag(context.flags["block"]);
      return {
        cwd,
        verbose: Boolean(context.flags["verbose"]),
        ...(block !== undefined ? { block } : {}),
        ci: Boolean(context.flags["ci"]),
        ...(outputMode ? { outputMode } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ci, ...checkInput } = input;
    const effectiveMode = ci ? "json" : outputMode;
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
      ...(effectiveMode ? { mode: effectiveMode } : {}),
      verbose: checkInput.verbose,
    });

    // Exit code 1 if any blocks drifted or missing
    if (result.value.driftedCount > 0 || result.value.missingCount > 0) {
      process.exit(1);
    }

    return Result.ok(result.value);
  },
});

interface UpdateActionInput {
  cwd: string;
  guide: boolean;
  guidePackages?: string[];
  apply: boolean;
  breaking: boolean;
  outputMode?: OutputMode;
}

const updateInputSchema = z.object({
  cwd: z.string(),
  guide: z.boolean(),
  guidePackages: z.array(z.string()).optional(),
  apply: z.boolean(),
  breaking: z.boolean(),
  outputMode: outputModeSchema,
}) as z.ZodType<UpdateActionInput>;

const updateAction = defineAction({
  id: "update",
  description: "Check for @outfitter/* package updates and migration guidance",
  surfaces: ["cli"],
  input: updateInputSchema,
  cli: {
    command: "update [packages...]",
    description:
      "Check for @outfitter/* package updates and migration guidance",
    options: [
      {
        flags: "--guide",
        description:
          "Show migration instructions for available updates. Pass package names to filter.",
        defaultValue: false,
      },
      {
        flags: "--apply",
        description:
          "Apply non-breaking updates to package.json and run bun install",
        defaultValue: false,
      },
      {
        flags: "--breaking",
        description: "Include breaking updates when used with --apply",
        defaultValue: false,
      },
      {
        flags: "--cwd <path>",
        description: "Working directory (defaults to current directory)",
      },
    ],
    mapInput: (context) => {
      const outputMode = resolveOutputMode(context.flags);
      const cwd =
        typeof context.flags["cwd"] === "string"
          ? resolve(process.cwd(), context.flags["cwd"])
          : process.cwd();
      const guidePackages =
        context.args.length > 0 ? (context.args as string[]) : undefined;
      return {
        cwd,
        guide: Boolean(context.flags["guide"]),
        ...(guidePackages !== undefined ? { guidePackages } : {}),
        apply: Boolean(context.flags["apply"]),
        breaking: Boolean(context.flags["breaking"]),
        ...(outputMode ? { outputMode } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, guidePackages, ...updateInput } = input;
    const result = await runUpdate({
      ...updateInput,
      ...(guidePackages !== undefined ? { guidePackages } : {}),
    });

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "update" },
        })
      );
    }

    await printUpdateResults(result.value, {
      ...(outputMode ? { mode: outputMode } : {}),
      guide: updateInput.guide,
      cwd: updateInput.cwd,
      applied: updateInput.apply ? result.value.applied : undefined,
      breaking: updateInput.breaking,
    });

    return Result.ok(result.value);
  },
});

const migrateKitAction = defineAction({
  id: "migrate.kit",
  description: "Migrate foundation imports and dependencies to @outfitter/kit",
  surfaces: ["cli"],
  input: migrateKitInputSchema,
  cli: {
    group: "migrate",
    command: "kit [directory]",
    description:
      "Migrate foundation imports and dependencies to @outfitter/kit",
    options: [
      {
        flags: "--dry-run",
        description: "Preview changes without writing files",
        defaultValue: false,
      },
    ],
    mapInput: resolveMigrateKitOptions,
  },
  handler: async (input) => {
    const { outputMode, ...migrateInput } = input;
    const outputOptions = outputMode ? { mode: outputMode } : undefined;
    const result = await runMigrateKit(migrateInput);

    if (result.isErr()) {
      return Result.err(
        new InternalError({
          message: result.error.message,
          context: { action: "migrate.kit" },
        })
      );
    }

    await printMigrateKitResults(result.value, outputOptions);
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
      includeTemplateOption: true,
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
  .add(demoAction)
  .add(doctorAction)
  .add(addAction)
  .add(listBlocksAction)
  .add(checkAction)
  .add(migrateKitAction)
  .add(updateAction);

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
import { printDemoResults, runDemo } from "./commands/demo.js";
import { printDoctorResults, runDoctor } from "./commands/doctor.js";
import type { InitOptions } from "./commands/init.js";
import { printInitResults, runInit } from "./commands/init.js";
import { printUpdateResults, runUpdate } from "./commands/update.js";

interface InitFlags {
  readonly name?: string | undefined;
  readonly bin?: unknown;
  readonly template?: unknown;
  readonly force?: unknown;
  readonly local?: unknown;
  readonly workspace?: unknown;
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
  template: z.string().optional(),
  local: z.boolean().optional(),
  force: z.boolean(),
  outputMode: outputModeSchema,
}) as z.ZodType<InitActionInput>;

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

function resolveInitOptions(
  context: ActionCliInputContext,
  templateOverride?: string
): InitActionInput {
  const flags = context.flags as InitFlags;
  const targetDir = context.args[0] ?? process.cwd();
  const name = resolveStringFlag(flags.name);
  const bin = resolveStringFlag(flags.bin);
  const template = templateOverride ?? resolveStringFlag(flags.template);
  const local = Boolean(flags.local || flags.workspace);
  const force = Boolean(flags.force);
  const outputMode = resolveOutputMode(context.flags);

  return {
    targetDir,
    name,
    template,
    local,
    force,
    ...(bin ? { bin } : {}),
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
    defaultValue: false,
  },
  {
    flags: "--workspace",
    description: "Alias for --local",
    defaultValue: false,
  },
];

const templateOption: ActionCliOption = {
  flags: "-t, --template <template>",
  description: "Template to use",
};

function createInitAction(options: {
  readonly id: string;
  readonly description: string;
  readonly command: string;
  readonly templateOverride?: string;
  readonly includeTemplateOption?: boolean;
}) {
  const initOptions = options.includeTemplateOption
    ? [...commonInitOptions, templateOption]
    : commonInitOptions;

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
        resolveInitOptions(context, options.templateOverride),
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

      await printInitResults(initInput.targetDir, result.value, outputOptions);

      return Result.ok({ ok: true });
    },
  });
}

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

    if (input.outputMode === "json" || input.outputMode === "jsonl") {
      await output({ blocks: result.value }, { mode: input.outputMode });
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

interface UpdateActionInput {
  cwd: string;
  guide: boolean;
  outputMode?: OutputMode;
}

const updateInputSchema = z.object({
  cwd: z.string(),
  guide: z.boolean(),
  outputMode: outputModeSchema,
}) as z.ZodType<UpdateActionInput>;

const updateAction = defineAction({
  id: "update",
  description: "Check for @outfitter/* package updates and migration guidance",
  surfaces: ["cli"],
  input: updateInputSchema,
  cli: {
    command: "update",
    description:
      "Check for @outfitter/* package updates and migration guidance",
    options: [
      {
        flags: "--guide",
        description: "Show migration instructions for available updates",
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
      return {
        cwd,
        guide: Boolean(context.flags["guide"]),
        ...(outputMode ? { outputMode } : {}),
      };
    },
  },
  handler: async (input) => {
    const { outputMode, ...updateInput } = input;
    const result = await runUpdate(updateInput);

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
    });

    return Result.ok(result.value);
  },
});

export const outfitterActions: ActionRegistry = createActionRegistry()
  .add(
    createInitAction({
      id: "init",
      description: "Scaffold a new Outfitter project",
      command: "[directory]",
      includeTemplateOption: true,
    })
  )
  .add(
    createInitAction({
      id: "init.cli",
      description: "Scaffold a new CLI project",
      command: "cli [directory]",
      templateOverride: "cli",
    })
  )
  .add(
    createInitAction({
      id: "init.mcp",
      description: "Scaffold a new MCP server",
      command: "mcp [directory]",
      templateOverride: "mcp",
    })
  )
  .add(
    createInitAction({
      id: "init.daemon",
      description: "Scaffold a new daemon project",
      command: "daemon [directory]",
      templateOverride: "daemon",
    })
  )
  .add(demoAction)
  .add(doctorAction)
  .add(addAction)
  .add(listBlocksAction)
  .add(updateAction);

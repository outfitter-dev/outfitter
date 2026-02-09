/**
 * `outfitter create` - Interactive project scaffolding flow.
 *
 * Uses the create planner contract to derive deterministic scaffolding steps,
 * then executes the resulting change protocol.
 *
 * @packageDocumentation
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cancel,
  confirm,
  intro,
  isCancel,
  outro,
  select,
  text,
} from "@clack/prompts";
import { exitWithError, output } from "@outfitter/cli/output";
import type { OutputMode } from "@outfitter/cli/types";
import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";
import type { Command } from "commander";
import {
  CREATE_PRESET_IDS,
  CREATE_PRESETS,
  type CreatePresetId,
  type CreateProjectPlan,
  planCreateProject,
} from "../create/index.js";
import { runAdd } from "./add.js";
import { SHARED_DEV_DEPS, SHARED_SCRIPTS } from "./shared-deps.js";

export type CreateStructure = "single" | "workspace";

export interface CreateOptions {
  readonly targetDir: string;
  readonly name?: string | undefined;
  readonly preset?: CreatePresetId | undefined;
  readonly structure?: CreateStructure | undefined;
  readonly workspaceName?: string | undefined;
  readonly local?: boolean | undefined;
  readonly force: boolean;
  readonly with?: string | undefined;
  readonly noTooling?: boolean | undefined;
  readonly yes?: boolean | undefined;
}

export interface CreateResult {
  readonly structure: CreateStructure;
  readonly rootDir: string;
  readonly projectDir: string;
  readonly preset: CreatePresetId;
  readonly packageName: string;
  readonly blocksAdded?: AddBlockResult | undefined;
}

export class CreateError extends Error {
  readonly _tag = "CreateError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CreateError";
  }
}

interface PlaceholderValues {
  readonly name: string;
  readonly projectName: string;
  readonly packageName: string;
  readonly binName: string;
  readonly version: string;
  readonly description: string;
  readonly year: string;
}

interface ResolvedCreateInput {
  readonly rootDir: string;
  readonly packageName: string;
  readonly preset: CreatePresetId;
  readonly structure: CreateStructure;
  readonly includeTooling: boolean;
  readonly blocksOverride?: readonly string[];
  readonly workspaceName?: string;
  readonly local: boolean;
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".bmp",
  ".tiff",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".webm",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".wasm",
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
  ".sqlite3",
]);

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function resolveYear(): string {
  return String(new Date().getFullYear());
}

function parseBlocks(
  withFlag: string | undefined
): readonly string[] | undefined {
  if (!withFlag) {
    return undefined;
  }

  const blocks = withFlag
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return blocks.length > 0 ? blocks : undefined;
}

function deriveProjectName(packageName: string): string {
  if (packageName.startsWith("@")) {
    const parts = packageName.split("/");
    if (parts.length > 1 && parts[1]) {
      return parts[1];
    }
  }
  return packageName;
}

function getTemplatesDir(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 10; i++) {
    const templatesPath = join(currentDir, "templates");
    if (existsSync(templatesPath)) {
      return templatesPath;
    }
    currentDir = dirname(currentDir);
  }

  return join(process.cwd(), "templates");
}

function getOutputFilename(templateFilename: string): string {
  if (templateFilename.endsWith(".template")) {
    return templateFilename.slice(0, -".template".length);
  }
  return templateFilename;
}

function isBinaryFile(filename: string): boolean {
  return BINARY_EXTENSIONS.has(extname(filename).toLowerCase());
}

function replacePlaceholders(
  content: string,
  values: PlaceholderValues
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.hasOwn(values, key)) {
      return values[key as keyof PlaceholderValues];
    }
    return match;
  });
}

function copyTemplateFiles(
  templateDir: string,
  targetDir: string,
  values: PlaceholderValues,
  force: boolean,
  allowOverwrite = false,
  overwritablePaths?: ReadonlySet<string>,
  writtenPaths?: Set<string>
): Result<void, CreateError> {
  try {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const entries = readdirSync(templateDir);

    for (const entry of entries) {
      const sourcePath = join(templateDir, entry);
      const sourceStat = statSync(sourcePath);

      if (sourceStat.isDirectory()) {
        const targetSubDir = join(targetDir, entry);
        const nestedResult = copyTemplateFiles(
          sourcePath,
          targetSubDir,
          values,
          force,
          allowOverwrite,
          overwritablePaths,
          writtenPaths
        );
        if (nestedResult.isErr()) {
          return nestedResult;
        }
        continue;
      }

      if (!sourceStat.isFile()) {
        continue;
      }

      const outputFilename = getOutputFilename(entry);
      const targetPath = join(targetDir, outputFilename);

      const targetExists = existsSync(targetPath);
      const canOverlay =
        allowOverwrite &&
        (!targetExists || Boolean(overwritablePaths?.has(targetPath)));

      if (targetExists && !force && !canOverlay) {
        return Result.err(
          new CreateError(
            `File '${targetPath}' already exists. Use --force to overwrite.`
          )
        );
      }

      if (isBinaryFile(outputFilename)) {
        const buffer = readFileSync(sourcePath);
        writeFileSync(targetPath, buffer);
        writtenPaths?.add(targetPath);
        continue;
      }

      const content = readFileSync(sourcePath, "utf-8");
      const processedContent = replacePlaceholders(content, values);
      writeFileSync(targetPath, processedContent, "utf-8");
      writtenPaths?.add(targetPath);
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new CreateError(`Failed to copy template files: ${message}`)
    );
  }
}

function injectSharedConfig(targetDir: string): Result<void, CreateError> {
  const packageJsonPath = join(targetDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return Result.ok(undefined);
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const existingDevDeps =
      (parsed["devDependencies"] as Record<string, unknown>) ?? {};
    parsed["devDependencies"] = { ...SHARED_DEV_DEPS, ...existingDevDeps };

    const existingScripts =
      (parsed["scripts"] as Record<string, unknown>) ?? {};
    parsed["scripts"] = { ...SHARED_SCRIPTS, ...existingScripts };

    writeFileSync(
      packageJsonPath,
      `${JSON.stringify(parsed, null, 2)}\n`,
      "utf-8"
    );

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new CreateError(`Failed to inject shared config: ${message}`)
    );
  }
}

function rewriteLocalDependencies(
  targetDir: string
): Result<void, CreateError> {
  const packageJsonPath = join(targetDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return Result.ok(undefined);
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    let updated = false;

    for (const section of DEPENDENCY_SECTIONS) {
      const deps = parsed[section];
      if (!deps || typeof deps !== "object" || Array.isArray(deps)) {
        continue;
      }

      const entries = deps as Record<string, unknown>;
      for (const [name, version] of Object.entries(entries)) {
        if (
          typeof version === "string" &&
          name.startsWith("@outfitter/") &&
          version !== "workspace:*"
        ) {
          entries[name] = "workspace:*";
          updated = true;
        }
      }
    }

    if (updated) {
      writeFileSync(
        packageJsonPath,
        `${JSON.stringify(parsed, null, 2)}\n`,
        "utf-8"
      );
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new CreateError(`Failed to update local dependencies: ${message}`)
    );
  }
}

async function addBlocks(
  targetDir: string,
  blocks: readonly string[],
  force: boolean
): Promise<Result<AddBlockResult, CreateError>> {
  const mergedResult: AddBlockResult = {
    created: [],
    skipped: [],
    overwritten: [],
    dependencies: {},
    devDependencies: {},
  };

  for (const blockName of blocks) {
    const result = await runAdd({
      block: blockName,
      force,
      dryRun: false,
      cwd: targetDir,
    });

    if (result.isErr()) {
      return Result.err(
        new CreateError(
          `Failed to add block '${blockName}': ${result.error.message}`
        )
      );
    }

    mergedResult.created.push(...result.value.created);
    mergedResult.skipped.push(...result.value.skipped);
    mergedResult.overwritten.push(...result.value.overwritten);
    Object.assign(mergedResult.dependencies, result.value.dependencies);
    Object.assign(mergedResult.devDependencies, result.value.devDependencies);
  }

  return Result.ok(mergedResult);
}

function findProjectTargetDir(
  plan: CreateProjectPlan
): Result<string, CreateError> {
  const copyStep = plan.changes.find(
    (change) => change.type === "copy-template"
  );

  if (!copyStep) {
    return Result.err(
      new CreateError("Planner output missing copy-template step")
    );
  }

  return Result.ok(copyStep.targetDir);
}

function applyBlockOverrides(
  plan: CreateProjectPlan,
  blocksOverride: readonly string[] | undefined
): CreateProjectPlan {
  if (!blocksOverride) {
    return plan;
  }

  const changesWithoutBlocks = plan.changes.filter(
    (change) => change.type !== "add-blocks"
  );

  if (blocksOverride.length === 0) {
    return {
      ...plan,
      changes: changesWithoutBlocks,
    };
  }

  return {
    ...plan,
    changes: [
      ...changesWithoutBlocks,
      { type: "add-blocks", blocks: blocksOverride },
    ],
  };
}

async function executePlan(
  plan: CreateProjectPlan,
  force: boolean
): Promise<Result<AddBlockResult | undefined, CreateError>> {
  const targetDirResult = findProjectTargetDir(plan);
  if (targetDirResult.isErr()) {
    return targetDirResult;
  }

  const targetDir = targetDirResult.value;
  const templatesDir = getTemplatesDir();
  const values: PlaceholderValues = {
    name: plan.values.projectName,
    projectName: plan.values.projectName,
    packageName: plan.values.packageName,
    binName: plan.values.binName,
    version: plan.values.version,
    description: plan.values.description,
    year: plan.values.year,
  };

  let blocksAdded: AddBlockResult | undefined;

  for (const change of plan.changes) {
    if (change.type === "copy-template") {
      const templatePath = join(templatesDir, change.template);
      if (!existsSync(templatePath)) {
        return Result.err(
          new CreateError(
            `Template '${change.template}' not found in ${templatesDir}`
          )
        );
      }

      if (change.overlayBaseTemplate) {
        const basePath = join(templatesDir, "_base");
        if (existsSync(basePath)) {
          const baseWrittenPaths = new Set<string>();
          const baseResult = copyTemplateFiles(
            basePath,
            targetDir,
            values,
            force,
            false,
            undefined,
            baseWrittenPaths
          );
          if (baseResult.isErr()) {
            return baseResult;
          }

          const templateResult = copyTemplateFiles(
            templatePath,
            targetDir,
            values,
            force,
            true,
            baseWrittenPaths
          );
          if (templateResult.isErr()) {
            return templateResult;
          }
          continue;
        }
      }

      const templateResult = copyTemplateFiles(
        templatePath,
        targetDir,
        values,
        force
      );
      if (templateResult.isErr()) {
        return templateResult;
      }
      continue;
    }

    if (change.type === "inject-shared-config") {
      const result = injectSharedConfig(targetDir);
      if (result.isErr()) {
        return result;
      }
      continue;
    }

    if (change.type === "rewrite-local-dependencies") {
      const result = rewriteLocalDependencies(targetDir);
      if (result.isErr()) {
        return result;
      }
      continue;
    }

    if (change.type === "add-blocks") {
      const result = await addBlocks(targetDir, change.blocks, force);
      if (result.isErr()) {
        return result;
      }
      blocksAdded = result.value;
    }
  }

  return Result.ok(blocksAdded);
}

function buildWorkspaceRootPackageJson(
  workspaceName: string,
  projectDirName: string
): string {
  const packagePath = `packages/${projectDirName}`;

  const workspacePackage = {
    name: workspaceName,
    private: true,
    version: "0.1.0",
    workspaces: ["packages/*"],
    scripts: {
      build: `bun run --cwd ${packagePath} build`,
      dev: `bun run --cwd ${packagePath} dev`,
      test: `bun run --cwd ${packagePath} test`,
      typecheck: `bun run --cwd ${packagePath} typecheck`,
      lint: `bun run --cwd ${packagePath} lint`,
      "lint:fix": `bun run --cwd ${packagePath} lint:fix`,
      format: `bun run --cwd ${packagePath} format`,
    },
  };

  return `${JSON.stringify(workspacePackage, null, 2)}\n`;
}

function scaffoldWorkspaceRoot(
  rootDir: string,
  workspaceName: string,
  projectDirName: string,
  force: boolean
): Result<void, CreateError> {
  const packageJsonPath = join(rootDir, "package.json");

  if (existsSync(packageJsonPath) && !force) {
    return Result.err(
      new CreateError(
        `Directory '${rootDir}' already has a package.json. Use --force to overwrite.`
      )
    );
  }

  try {
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
    }

    mkdirSync(join(rootDir, "packages"), { recursive: true });

    writeFileSync(
      packageJsonPath,
      buildWorkspaceRootPackageJson(workspaceName, projectDirName),
      "utf-8"
    );

    const gitignorePath = join(rootDir, ".gitignore");
    if (force || !existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, "node_modules\n**/dist\n", "utf-8");
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new CreateError(`Failed to scaffold workspace root: ${message}`)
    );
  }
}

async function resolveInput(
  options: CreateOptions
): Promise<Result<ResolvedCreateInput, CreateError>> {
  const rootDir = resolve(options.targetDir);
  const defaultName = basename(rootDir);

  if (options.yes) {
    const packageName = (options.name ?? defaultName).trim();
    if (packageName.length === 0) {
      return Result.err(new CreateError("Project name must not be empty"));
    }

    const structure = options.structure ?? "single";
    const blocksOverride = parseBlocks(options.with);
    const workspaceName =
      (options.workspaceName ?? defaultName).trim() || defaultName;

    return Result.ok({
      rootDir,
      packageName,
      preset: options.preset ?? "basic",
      structure,
      includeTooling: !(options.noTooling ?? false),
      local: Boolean(options.local),
      ...(blocksOverride ? { blocksOverride } : {}),
      ...(structure === "workspace" ? { workspaceName } : {}),
    });
  }

  intro("Outfitter create");

  const packageNameValue =
    options.name ??
    (await text({
      message: "Project package name",
      placeholder: defaultName,
      initialValue: defaultName,
      validate: (value) =>
        value.trim().length === 0 ? "Project name is required" : undefined,
    }));

  if (isCancel(packageNameValue)) {
    cancel("Create cancelled.");
    return Result.err(new CreateError("Create cancelled"));
  }

  const presetValue =
    options.preset ??
    (await select<CreatePresetId>({
      message: "Select a preset",
      options: CREATE_PRESET_IDS.map((id) => ({
        value: id,
        label: id,
        hint: CREATE_PRESETS[id].summary,
      })),
      initialValue: "basic",
    }));

  if (isCancel(presetValue)) {
    cancel("Create cancelled.");
    return Result.err(new CreateError("Create cancelled"));
  }

  const structureValue =
    options.structure ??
    (await select<CreateStructure>({
      message: "Project structure",
      options: [
        {
          value: "single",
          label: "Single package",
          hint: "One package in the target directory",
        },
        {
          value: "workspace",
          label: "Workspace",
          hint: "Root workspace with project under packages/",
        },
      ],
      initialValue: "single",
    }));

  if (isCancel(structureValue)) {
    cancel("Create cancelled.");
    return Result.err(new CreateError("Create cancelled"));
  }

  const includeTooling =
    options.noTooling !== undefined
      ? !options.noTooling
      : await confirm({
          message: "Add default tooling blocks?",
          initialValue: true,
        });

  if (isCancel(includeTooling)) {
    cancel("Create cancelled.");
    return Result.err(new CreateError("Create cancelled"));
  }

  const localValue =
    options.local !== undefined
      ? options.local
      : await confirm({
          message: "Use workspace:* for @outfitter dependencies?",
          initialValue: false,
        });

  if (isCancel(localValue)) {
    cancel("Create cancelled.");
    return Result.err(new CreateError("Create cancelled"));
  }

  let workspaceName: string | undefined;
  if (structureValue === "workspace") {
    const workspaceNameValue =
      options.workspaceName ??
      (await text({
        message: "Workspace package name",
        placeholder: defaultName,
        initialValue: defaultName,
        validate: (value) =>
          value.trim().length === 0 ? "Workspace name is required" : undefined,
      }));

    if (isCancel(workspaceNameValue)) {
      cancel("Create cancelled.");
      return Result.err(new CreateError("Create cancelled"));
    }

    workspaceName = workspaceNameValue.trim();
  }

  outro("Scaffolding project...");

  const packageName = packageNameValue.trim();
  if (packageName.length === 0) {
    return Result.err(new CreateError("Project name must not be empty"));
  }

  const blocksOverride = parseBlocks(options.with);

  return Result.ok({
    rootDir,
    packageName,
    preset: presetValue,
    structure: structureValue,
    includeTooling,
    local: Boolean(localValue),
    ...(blocksOverride ? { blocksOverride } : {}),
    ...(workspaceName ? { workspaceName } : {}),
  });
}

export async function runCreate(
  options: CreateOptions
): Promise<Result<CreateResult, CreateError>> {
  const inputResult = await resolveInput(options);
  if (inputResult.isErr()) {
    return inputResult;
  }

  const input = inputResult.value;
  const projectDir =
    input.structure === "workspace"
      ? join(input.rootDir, "packages", deriveProjectName(input.packageName))
      : input.rootDir;

  const planResult = planCreateProject({
    name: input.packageName,
    targetDir: projectDir,
    preset: input.preset,
    includeTooling: input.includeTooling,
    local: input.local,
    year: resolveYear(),
  });

  if (planResult.isErr()) {
    return Result.err(new CreateError(planResult.error.message));
  }

  const plan = applyBlockOverrides(planResult.value, input.blocksOverride);

  if (input.structure === "workspace") {
    const workspaceName =
      input.workspaceName && input.workspaceName.length > 0
        ? input.workspaceName
        : basename(input.rootDir);

    const workspaceResult = scaffoldWorkspaceRoot(
      input.rootDir,
      workspaceName,
      deriveProjectName(input.packageName),
      options.force
    );

    if (workspaceResult.isErr()) {
      return workspaceResult;
    }
  } else if (
    existsSync(join(input.rootDir, "package.json")) &&
    !options.force
  ) {
    return Result.err(
      new CreateError(
        `Directory '${input.rootDir}' already has a package.json. Use --force to overwrite.`
      )
    );
  }

  const executeResult = await executePlan(plan, options.force);
  if (executeResult.isErr()) {
    return executeResult;
  }

  return Result.ok({
    structure: input.structure,
    rootDir: input.rootDir,
    projectDir,
    preset: input.preset,
    packageName: input.packageName,
    blocksAdded: executeResult.value,
  });
}

export async function printCreateResults(
  result: CreateResult,
  options?: { mode?: OutputMode }
): Promise<void> {
  const mode = options?.mode;
  if (mode === "json" || mode === "jsonl") {
    await output(
      {
        structure: result.structure,
        rootDir: result.rootDir,
        projectDir: result.projectDir,
        preset: result.preset,
        packageName: result.packageName,
        blocksAdded: result.blocksAdded ?? null,
        nextSteps: ["bun install", "bun run build", "bun run test"],
      },
      { mode }
    );
    return;
  }

  const lines: string[] = [
    `Project created successfully in ${result.rootDir}`,
    `Structure: ${result.structure}`,
    `Preset: ${result.preset}`,
  ];

  if (result.structure === "workspace") {
    lines.push(`Workspace project path: ${result.projectDir}`);
  }

  if (result.blocksAdded) {
    if (result.blocksAdded.created.length > 0) {
      lines.push(
        "",
        `Added ${result.blocksAdded.created.length} tooling file(s):`
      );
      for (const file of result.blocksAdded.created) {
        lines.push(`  ✓ ${file}`);
      }
    }

    if (result.blocksAdded.skipped.length > 0) {
      lines.push(
        "",
        `Skipped ${result.blocksAdded.skipped.length} existing file(s):`
      );
      for (const file of result.blocksAdded.skipped) {
        lines.push(`  - ${file}`);
      }
    }
  }

  lines.push("", "Next steps:");
  if (result.structure === "workspace") {
    lines.push("  bun install", `  bun run --cwd ${result.projectDir} dev`);
  } else {
    lines.push("  bun install", "  bun run dev");
  }

  await output(lines);
}

export function createCommand(program: Command): void {
  interface CreateCommandFlags {
    name?: string;
    preset?: CreatePresetId;
    structure?: CreateStructure;
    workspaceName?: string;
    local?: boolean;
    workspace?: boolean;
    force?: boolean;
    with?: string;
    noTooling?: boolean;
    yes?: boolean;
  }

  program
    .command("create [directory]")
    .description("Interactive scaffolding flow for Outfitter projects")
    .option("-n, --name <name>", "Package name")
    .option(
      "-p, --preset <preset>",
      `Preset to scaffold (${CREATE_PRESET_IDS.join(", ")})`
    )
    .option("-s, --structure <mode>", "Project structure (single|workspace)")
    .option("--workspace-name <name>", "Workspace root package name")
    .option("--local", "Use workspace:* for @outfitter dependencies", false)
    .option("--workspace", "Alias for --local", false)
    .option("-f, --force", "Overwrite existing files", false)
    .option("--with <blocks>", "Comma-separated tooling blocks to add")
    .option("--no-tooling", "Skip default tooling blocks")
    .option("-y, --yes", "Skip prompts and use defaults", false)
    .action(
      async (targetDir: string | undefined, flags: CreateCommandFlags) => {
        const result = await runCreate({
          targetDir: targetDir ?? process.cwd(),
          name: flags.name,
          preset: flags.preset,
          structure: flags.structure,
          workspaceName: flags.workspaceName,
          local: Boolean(flags.local || flags.workspace),
          force: Boolean(flags.force),
          with: flags.with,
          noTooling: flags.noTooling,
          yes: Boolean(flags.yes),
        });

        if (result.isErr()) {
          exitWithError(result.error);
          return;
        }

        await printCreateResults(result.value);
      }
    );
}

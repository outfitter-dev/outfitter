/**
 * `outfitter init` - Scaffolds a new Outfitter project.
 *
 * Creates a new project structure from a template, replacing placeholders
 * with project-specific values.
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
// CLI is non-interactive. For guided init, use /scaffold skill in Claude Code.
import { Result } from "@outfitter/contracts";
import type { AddBlockResult } from "@outfitter/tooling";
import type { Command } from "commander";
import { runAdd } from "./add.js";
import { SHARED_DEV_DEPS, SHARED_SCRIPTS } from "./shared-deps.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the init command.
 */
export interface InitOptions {
  /** Target directory to initialize the project in */
  readonly targetDir: string;
  /** Package name (defaults to directory name if not provided) */
  readonly name: string | undefined;
  /** Binary name (defaults to project name if not provided) */
  readonly bin?: string | undefined;
  /** Template to use (defaults to 'basic') */
  readonly template: string | undefined;
  /** Whether to use local/workspace dependencies */
  readonly local?: boolean | undefined;
  /** Whether to overwrite existing files */
  readonly force: boolean;
  /** Tooling blocks to add (e.g., "scaffolding" or "claude,biome,lefthook") */
  readonly with?: string | undefined;
  /** Skip tooling prompt in interactive mode */
  readonly noTooling?: boolean | undefined;
}

/**
 * Result of running init, including any blocks added.
 */
export interface InitResult {
  /** The blocks that were added, if any */
  readonly blocksAdded?: AddBlockResult | undefined;
}

/**
 * Placeholder values for template substitution.
 */
interface PlaceholderValues {
  readonly name: string;
  readonly projectName: string;
  readonly packageName: string;
  readonly binName: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly year: string;
}

/**
 * Error returned when initialization fails.
 */
export class InitError extends Error {
  readonly _tag = "InitError" as const;

  constructor(message: string) {
    super(message);
    this.name = "InitError";
  }
}

// =============================================================================
// Binary File Detection
// =============================================================================

/**
 * Set of file extensions known to be binary formats.
 * These files should be copied as raw buffers without placeholder substitution.
 */
const BINARY_EXTENSIONS = new Set([
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".bmp",
  ".tiff",
  ".svg", // SVG is text but often contains complex content that shouldn't be modified
  // Fonts
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  // Audio/Video
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".webm",
  // Archives
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  // Documents
  ".pdf",
  // Executables/Libraries
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".wasm",
  // Other binary formats
  ".bin",
  ".dat",
  ".db",
  ".sqlite",
  ".sqlite3",
]);

/**
 * Checks if a file should be treated as binary based on its extension.
 *
 * @param filename - The filename to check
 * @returns True if the file is binary, false otherwise
 */
function isBinaryFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// =============================================================================
// Template Processing
// =============================================================================

/**
 * Gets the path to the templates directory.
 */
function getTemplatesDir(): string {
  // Templates are stored at the monorepo root
  // Walk up from the current file location to find templates/
  // Use fileURLToPath to properly decode percent-encoded paths (e.g., spaces)
  let currentDir = dirname(fileURLToPath(import.meta.url));

  // Walk up until we find the templates directory
  for (let i = 0; i < 10; i++) {
    const templatesPath = join(currentDir, "templates");
    if (existsSync(templatesPath)) {
      return templatesPath;
    }
    currentDir = dirname(currentDir);
  }

  // Fallback: assume we're running from the monorepo root
  return join(process.cwd(), "templates");
}

/**
 * Validates that a template exists.
 */
function validateTemplate(templateName: string): Result<string, InitError> {
  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, templateName);

  if (!existsSync(templatePath)) {
    return Result.err(
      new InitError(
        `Template '${templateName}' not found. Available templates are in: ${templatesDir}`
      )
    );
  }

  return Result.ok(templatePath);
}

/**
 * Replaces placeholders in content.
 *
 * Placeholders are in the format {{name}}, {{version}}, etc.
 */
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

/**
 * Gets the output filename by removing .template extension.
 */
function getOutputFilename(templateFilename: string): string {
  if (templateFilename.endsWith(".template")) {
    return templateFilename.slice(0, -".template".length);
  }
  return templateFilename;
}

// =============================================================================
// Name Resolution
// =============================================================================

/**
 * Checks if package.json exists in the target directory.
 */
function hasPackageJson(targetDir: string): boolean {
  return existsSync(join(targetDir, "package.json"));
}

/**
 * Derives project name from package name.
 * For scoped packages (@org/name), returns the name part.
 */
function deriveProjectName(packageName: string): string {
  if (packageName.startsWith("@")) {
    const parts = packageName.split("/");
    if (parts.length > 1 && parts[1]) {
      return parts[1];
    }
  }
  return packageName;
}

/**
 * Resolves package name from options or directory name.
 */
function resolvePackageName(
  options: InitOptions,
  resolvedTargetDir: string
): string {
  return options.name ?? basename(resolvedTargetDir);
}

/**
 * Resolves binary name from options or project name.
 */
function resolveBinName(options: InitOptions, projectName: string): string {
  return options.bin ?? deriveProjectName(projectName);
}

/**
 * Resolves template name from options or defaults to "basic".
 */
function resolveTemplateName(options: InitOptions): string {
  return options.template ?? "basic";
}

function resolveAuthor(): string {
  const fromEnv =
    process.env["GIT_AUTHOR_NAME"] ??
    process.env["GIT_COMMITTER_NAME"] ??
    process.env["AUTHOR"] ??
    process.env["USER"] ??
    process.env["USERNAME"];

  if (fromEnv) {
    return fromEnv;
  }

  try {
    const result = Bun.spawnSync(["git", "config", "--get", "user.name"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    if (result.exitCode === 0) {
      const value = result.stdout.toString().trim();
      return value.length > 0 ? value : "";
    }
  } catch {
    // Ignore git lookup errors and fall back to empty string
  }

  return "";
}

function resolveYear(): string {
  return String(new Date().getFullYear());
}

/**
 * Resolves which tooling blocks to add.
 * Defaults to scaffolding unless --no-tooling is specified.
 */
function resolveBlocks(options: InitOptions): string[] | undefined {
  // If --no-tooling specified, skip entirely
  if (options.noTooling) {
    return undefined;
  }

  // If --with specified, parse and use those
  if (options.with) {
    const blocks = options.with
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    return blocks.length > 0 ? blocks : undefined;
  }

  // Default to scaffolding
  return ["scaffolding"];
}

/**
 * Recursively copies template files to the target directory.
 */
function copyTemplateFiles(
  templateDir: string,
  targetDir: string,
  values: PlaceholderValues,
  force: boolean,
  allowOverwrite = false
): Result<void, InitError> {
  try {
    // Ensure target directory exists
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const entries = readdirSync(templateDir);

    for (const entry of entries) {
      const sourcePath = join(templateDir, entry);
      const stat = statSync(sourcePath);

      if (stat.isDirectory()) {
        // Recursively copy directories
        const targetSubDir = join(targetDir, entry);
        const result = copyTemplateFiles(
          sourcePath,
          targetSubDir,
          values,
          force,
          allowOverwrite
        );
        if (result.isErr()) {
          return result;
        }
      } else if (stat.isFile()) {
        // Process and copy files
        const outputFilename = getOutputFilename(entry);
        const targetPath = join(targetDir, outputFilename);

        // Check if file exists and force is not set
        if (existsSync(targetPath) && !force && !allowOverwrite) {
          return Result.err(
            new InitError(
              `File '${targetPath}' already exists. Use --force to overwrite.`
            )
          );
        }

        // Handle binary files separately to avoid corruption
        if (isBinaryFile(outputFilename)) {
          // Copy binary files as raw buffers without modification
          const buffer = readFileSync(sourcePath);
          writeFileSync(targetPath, buffer);
        } else {
          // Read and process template content for text files
          const content = readFileSync(sourcePath, "utf-8");
          const processedContent = replacePlaceholders(content, values);

          // Write the processed content
          writeFileSync(targetPath, processedContent, "utf-8");
        }
      }
    }

    return Result.ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new InitError(`Failed to copy template files: ${message}`)
    );
  }
}

// =============================================================================
// Local Dependency Rewrites
// =============================================================================

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function rewriteLocalDependencies(targetDir: string): Result<void, InitError> {
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
      new InitError(`Failed to update local dependencies: ${message}`)
    );
  }
}

/**
 * Injects shared devDependencies and scripts into the project's package.json.
 *
 * Template-specific values take precedence over shared defaults.
 */
function injectSharedConfig(targetDir: string): Result<void, InitError> {
  const packageJsonPath = join(targetDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return Result.ok(undefined);
  }

  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Merge shared devDependencies (template-specific ones take precedence)
    const existingDevDeps =
      (parsed["devDependencies"] as Record<string, unknown>) ?? {};
    parsed["devDependencies"] = { ...SHARED_DEV_DEPS, ...existingDevDeps };

    // Merge shared scripts (template-specific ones take precedence)
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
      new InitError(`Failed to inject shared config: ${message}`)
    );
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Runs the init command programmatically.
 *
 * @param options - Init options
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await runInit({
 *   targetDir: "./my-project",
 *   name: "my-project",
 *   template: "basic",
 *   force: false,
 *   blocks: "scaffolding", // Optional: add tooling blocks
 * });
 *
 * if (result.isOk()) {
 *   console.log("Project initialized successfully!");
 *   if (result.value.blocksAdded) {
 *     console.log(`Added ${result.value.blocksAdded.created.length} tooling files`);
 *   }
 * } else {
 *   console.error("Failed:", result.error.message);
 * }
 * ```
 */
export async function runInit(
  options: InitOptions
): Promise<Result<InitResult, InitError>> {
  const { targetDir, force } = options;

  // Resolve target directory
  const resolvedTargetDir = resolve(targetDir);

  // Check for existing package.json (indicates existing project)
  if (hasPackageJson(resolvedTargetDir) && !force) {
    return Result.err(
      new InitError(
        `Directory '${resolvedTargetDir}' already has a package.json. ` +
          `Use --force to overwrite, or use 'outfitter add' to add tooling to an existing project.`
      )
    );
  }

  // Determine template
  const templateName = resolveTemplateName(options);

  // Validate template exists
  const templateResult = validateTemplate(templateName);
  if (templateResult.isErr()) {
    return templateResult;
  }
  const templatePath = templateResult.value;

  // Determine package name and binary name
  const packageName = resolvePackageName(options, resolvedTargetDir);
  const projectName = deriveProjectName(packageName);
  const binName = resolveBinName(options, projectName);

  const author = resolveAuthor();
  const year = resolveYear();

  // Prepare placeholder values
  const values: PlaceholderValues = {
    name: projectName,
    projectName,
    packageName,
    binName,
    version: "0.1.0-rc.0",
    description: "A new project created with Outfitter",
    author,
    year,
  };

  // Ensure target directory exists
  try {
    if (!existsSync(resolvedTargetDir)) {
      mkdirSync(resolvedTargetDir, { recursive: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Result.err(
      new InitError(`Failed to create target directory: ${message}`)
    );
  }

  // Two-layer template copy: first _base/, then template-specific
  const templatesDir = getTemplatesDir();
  const basePath = join(templatesDir, "_base");

  // Layer 1: Copy shared base (if exists)
  if (existsSync(basePath)) {
    const baseResult = copyTemplateFiles(
      basePath,
      resolvedTargetDir,
      values,
      force
    );
    if (baseResult.isErr()) {
      return baseResult;
    }
  }

  // Layer 2: Overlay template-specific files
  const copyResult = copyTemplateFiles(
    templatePath,
    resolvedTargetDir,
    values,
    force,
    true
  );
  if (copyResult.isErr()) {
    return copyResult;
  }

  // Inject shared devDependencies and scripts
  const injectResult = injectSharedConfig(resolvedTargetDir);
  if (injectResult.isErr()) {
    return injectResult;
  }

  if (options.local) {
    const rewriteResult = rewriteLocalDependencies(resolvedTargetDir);
    if (rewriteResult.isErr()) {
      return rewriteResult;
    }
  }

  // Resolve and add registry blocks
  const blocks = resolveBlocks(options);
  let blocksAdded: AddBlockResult | undefined;

  if (blocks && blocks.length > 0) {
    // Merge results from all blocks
    const mergedResult: AddBlockResult = {
      created: [],
      skipped: [],
      overwritten: [],
      dependencies: {},
      devDependencies: {},
    };

    for (const blockName of blocks) {
      const addResult = await runAdd({
        block: blockName,
        force,
        dryRun: false,
        cwd: resolvedTargetDir,
      });

      if (addResult.isErr()) {
        // Wrap add errors as init errors for consistent error handling
        return Result.err(
          new InitError(
            `Failed to add block '${blockName}': ${addResult.error.message}`
          )
        );
      }

      const blockResult = addResult.value;
      mergedResult.created.push(...blockResult.created);
      mergedResult.skipped.push(...blockResult.skipped);
      mergedResult.overwritten.push(...blockResult.overwritten);
      Object.assign(mergedResult.dependencies, blockResult.dependencies);
      Object.assign(mergedResult.devDependencies, blockResult.devDependencies);
    }

    blocksAdded = mergedResult;
  }

  return Result.ok({ blocksAdded });
}

/**
 * Registers the init command with the CLI program.
 *
 * @param program - Commander program instance
 *
 * @example
 * ```typescript
 * import { Command } from "commander";
 * import { initCommand } from "./commands/init.js";
 *
 * const program = new Command();
 * initCommand(program);
 * ```
 */
export function initCommand(program: Command): void {
  const init = program
    .command("init")
    .description("Scaffold a new Outfitter project");

  interface InitCommandFlags {
    name?: string;
    bin?: string;
    template?: string;
    force?: boolean;
    local?: boolean;
    workspace?: boolean;
    with?: string;
    noTooling?: boolean;
    opts?: () => InitCommandFlags;
  }

  const resolveFlags = (
    flags: InitCommandFlags,
    command?: Command
  ): InitCommandFlags => {
    if (command) {
      return command.optsWithGlobals<InitCommandFlags>();
    }
    return typeof flags.opts === "function" ? flags.opts() : flags;
  };

  const resolveLocal = (flags: InitCommandFlags): boolean =>
    Boolean(flags.local || flags.workspace);

  const withCommonOptions = (command: Command): Command =>
    command
      .option("-n, --name <name>", "Package name (defaults to directory name)")
      .option("-b, --bin <name>", "Binary name (defaults to project name)")
      .option("-f, --force", "Overwrite existing files", false)
      .option("--local", "Use workspace:* for @outfitter dependencies", false)
      .option("--workspace", "Alias for --local", false)
      .option(
        "--with <blocks>",
        "Tooling to add (comma-separated: scaffolding, claude, biome, lefthook, bootstrap)"
      )
      .option("--no-tooling", "Skip tooling setup");

  const printInitResult = (targetDir: string, result: InitResult): void => {
    console.log(`Project initialized successfully in ${resolve(targetDir)}`);

    if (result.blocksAdded) {
      const { created, skipped, dependencies, devDependencies } =
        result.blocksAdded;

      if (created.length > 0) {
        console.log(`\nAdded ${created.length} tooling file(s):`);
        for (const file of created) {
          console.log(`  ✓ ${file}`);
        }
      }

      if (skipped.length > 0) {
        console.log(`\nSkipped ${skipped.length} existing file(s):`);
        for (const file of skipped) {
          console.log(`  - ${file}`);
        }
      }

      const depCount =
        Object.keys(dependencies).length + Object.keys(devDependencies).length;
      if (depCount > 0) {
        console.log(`\nAdded ${depCount} package(s) to package.json:`);
        for (const [name, version] of Object.entries(dependencies)) {
          console.log(`  + ${name}@${version}`);
        }
        for (const [name, version] of Object.entries(devDependencies)) {
          console.log(`  + ${name}@${version} (dev)`);
        }
      }
    }

    console.log("\nNext steps:");
    console.log("  bun install");
    console.log("  bun run dev");
  };

  withCommonOptions(
    init
      .argument("[directory]")
      .option("-t, --template <template>", "Template to use")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const local = resolveLocal(resolvedFlags);

      const result = await runInit({
        targetDir,
        name: resolvedFlags.name,
        template: resolvedFlags.template,
        local,
        force: resolvedFlags.force ?? false,
        with: resolvedFlags.with,
        noTooling: resolvedFlags.noTooling,
        ...(resolvedFlags.bin !== undefined ? { bin: resolvedFlags.bin } : {}),
      });

      if (result.isErr()) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      printInitResult(targetDir, result.value);
    }
  );

  withCommonOptions(
    init.command("cli [directory]").description("Scaffold a new CLI project")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const local = resolveLocal(resolvedFlags);

      const result = await runInit({
        targetDir,
        name: resolvedFlags.name,
        template: "cli",
        local,
        force: resolvedFlags.force ?? false,
        with: resolvedFlags.with,
        noTooling: resolvedFlags.noTooling,
        ...(resolvedFlags.bin !== undefined ? { bin: resolvedFlags.bin } : {}),
      });

      if (result.isErr()) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      printInitResult(targetDir, result.value);
    }
  );

  withCommonOptions(
    init.command("mcp [directory]").description("Scaffold a new MCP server")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const local = resolveLocal(resolvedFlags);

      const result = await runInit({
        targetDir,
        name: resolvedFlags.name,
        template: "mcp",
        local,
        force: resolvedFlags.force ?? false,
        with: resolvedFlags.with,
        noTooling: resolvedFlags.noTooling,
        ...(resolvedFlags.bin !== undefined ? { bin: resolvedFlags.bin } : {}),
      });

      if (result.isErr()) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      printInitResult(targetDir, result.value);
    }
  );

  withCommonOptions(
    init
      .command("daemon [directory]")
      .description("Scaffold a new daemon project")
  ).action(
    async (
      directory: string | undefined,
      flags: InitCommandFlags,
      command: Command
    ) => {
      const targetDir = directory ?? process.cwd();
      const resolvedFlags = resolveFlags(flags, command);
      const local = resolveLocal(resolvedFlags);

      const result = await runInit({
        targetDir,
        name: resolvedFlags.name,
        template: "daemon",
        local,
        force: resolvedFlags.force ?? false,
        with: resolvedFlags.with,
        noTooling: resolvedFlags.noTooling,
        ...(resolvedFlags.bin !== undefined ? { bin: resolvedFlags.bin } : {}),
      });

      if (result.isErr()) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      printInitResult(targetDir, result.value);
    }
  );
}

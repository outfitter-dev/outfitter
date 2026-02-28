/**
 * Action registry completeness scanner.
 *
 * Cross-references `apps/outfitter/src/commands/` files against the actual
 * `createActionRegistry().add()` chain in `apps/outfitter/src/actions.ts`
 * to find command files not represented in the action registry.
 *
 * @packageDocumentation
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

const COMMANDS_RELATIVE_DIR = "apps/outfitter/src/commands";
const ACTIONS_RELATIVE_DIR = "apps/outfitter/src/actions";
const REGISTRY_RELATIVE_PATH = "apps/outfitter/src/actions.ts";
const LOCAL_REGISTRY_RELATIVE_PATH = "src/actions.ts";
const LOCAL_COMMANDS_RELATIVE_DIR = "src/commands";

/** Options for the action registry completeness scanner. */
export interface CheckActionRegistryOptions {
  /** Workspace root used to locate the commands and actions directories. */
  readonly cwd: string;
}

/** Result of the action registry completeness scan. */
export interface CheckActionRegistryResult {
  /** Resolved path to the scanned actions directory. */
  readonly actionsDir: string;
  /** Resolved path to the scanned commands directory. */
  readonly commandsDir: string;
  /** True when every command file is referenced by an action definition. */
  readonly ok: boolean;
  /** Command files referenced by at least one action definition. */
  readonly registered: readonly string[];
  /** Number of registered command files. */
  readonly registeredCount: number;
  /** Total number of command files scanned. */
  readonly totalCommands: number;
  /** Command files not referenced by any action definition. */
  readonly unregistered: readonly string[];
  /** Number of unregistered command files. */
  readonly unregisteredCount: number;
}

/** Error raised when the action registry scan cannot complete. */
export class CheckActionRegistryError extends Error {
  readonly _tag = "CheckActionRegistryError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckActionRegistryError";
  }
}

/**
 * Extract command file references from an action source file.
 *
 * Parses import statements matching `from "../commands/<name>.js"` or
 * `from "../commands/<name>.ts"` and returns the set of referenced
 * command file basenames (with `.ts` extension).
 */
function extractCommandImports(content: string): Set<string> {
  const imports = new Set<string>();
  // Match imports like: from "../commands/check.js" or from "../commands/check.ts"
  const importPattern = /from\s+["']\.\.\/commands\/([^"']+)\.(js|ts)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(content)) !== null) {
    const basename = match[1];
    if (basename) {
      imports.add(`${basename}.ts`);
    }
  }
  return imports;
}

/**
 * Parse the action registry file (`actions.ts`) to determine which action
 * symbols are registered via `.add()` and which source files they come from.
 *
 * Returns the set of action definition file basenames (with `.ts` extension)
 * that contain at least one action added to the registry.
 */
function extractRegisteredActionFiles(registryContent: string): Set<string> {
  // 1. Parse import statements: import { sym1, sym2 } from "./actions/foo.js"
  const importMap = new Map<string, string>();
  const importPattern =
    /import\s+\{([^}]+)\}\s+from\s+["']\.\/actions\/([^"']+)\.(js|ts)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(registryContent)) !== null) {
    const symbols = match[1]!.split(",").map((s) => s.trim());
    const file = `${match[2]}.ts`;
    for (const sym of symbols) {
      // Handle `type Foo` imports — skip them
      const cleaned = sym.replace(/^type\s+/, "");
      if (cleaned) {
        importMap.set(cleaned, file);
      }
    }
  }

  // 2. Parse .add(symbolName) calls from the registry chain
  const addPattern = /\.add\((\w+)\)/g;
  const registeredFiles = new Set<string>();
  while ((match = addPattern.exec(registryContent)) !== null) {
    const symbol = match[1]!;
    const file = importMap.get(symbol);
    if (file) {
      registeredFiles.add(file);
    }
  }

  return registeredFiles;
}

/**
 * List all `.ts` files in a directory, returning basenames only.
 *
 * Skips `__tests__` directories and non-`.ts` files.
 */
function listTsFiles(dir: string): readonly string[] {
  return readdirSync(dir)
    .filter(
      (entry) =>
        entry.endsWith(".ts") &&
        !entry.startsWith("__") &&
        !entry.endsWith(".test.ts")
    )
    .toSorted();
}

/**
 * Resolve workspace root from either repository root or nested `apps/outfitter` cwd.
 *
 * Supports:
 * - `<repo-root>` (contains `apps/outfitter/src/actions.ts`)
 * - `<repo-root>/apps/outfitter` (contains `src/actions.ts`)
 * - Any nested descendant under either location by walking upward
 */
function resolveWorkspaceRoot(cwd: string): string {
  const resolved = resolve(cwd);

  // Fast path: already at workspace root.
  if (existsSync(resolve(resolved, REGISTRY_RELATIVE_PATH))) {
    return resolved;
  }

  // Support running from apps/outfitter directly.
  if (
    existsSync(resolve(resolved, LOCAL_REGISTRY_RELATIVE_PATH)) &&
    existsSync(resolve(resolved, LOCAL_COMMANDS_RELATIVE_DIR))
  ) {
    const parentWorkspace = resolve(resolved, "../..");
    if (existsSync(resolve(parentWorkspace, REGISTRY_RELATIVE_PATH))) {
      return parentWorkspace;
    }
  }

  // Fallback: walk ancestors and find a directory containing the registry path.
  let current = resolved;
  while (true) {
    if (existsSync(resolve(current, REGISTRY_RELATIVE_PATH))) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      return resolved;
    }
    current = parent;
  }
}

/**
 * Scan the actual action registry and cross-reference against command files.
 *
 * Parses the `createActionRegistry().add()` chain in `actions.ts` to determine
 * which action symbols are registered, traces them back to their source action
 * definition files, and extracts which command files those definitions import.
 * Returns per-file classification (with relative paths) and an aggregate pass/fail.
 */
export async function runCheckActionRegistry(
  options: CheckActionRegistryOptions
): Promise<Result<CheckActionRegistryResult, CheckActionRegistryError>> {
  try {
    const workspaceRoot = resolveWorkspaceRoot(options.cwd);
    const commandsDir = resolve(workspaceRoot, COMMANDS_RELATIVE_DIR);
    const actionsDir = resolve(workspaceRoot, ACTIONS_RELATIVE_DIR);
    const registryPath = resolve(workspaceRoot, REGISTRY_RELATIVE_PATH);

    // 1. Parse the registry file to find which action files have registered actions
    const registryContent = readFileSync(registryPath, "utf-8");
    const registeredActionFiles = extractRegisteredActionFiles(registryContent);

    // 2. Only read action files that contribute registered actions
    const referencedCommands = new Set<string>();
    for (const actionFile of registeredActionFiles) {
      const filePath = resolve(actionsDir, actionFile);
      const content = readFileSync(filePath, "utf-8");
      const imports = extractCommandImports(content);
      for (const imp of imports) {
        referencedCommands.add(imp);
      }
    }

    // 3. List all command files
    const commandFiles = listTsFiles(commandsDir);

    // 4. Classify each command file using relative paths
    const registered: string[] = [];
    const unregistered: string[] = [];

    for (const file of commandFiles) {
      const relativePath = join(COMMANDS_RELATIVE_DIR, file);
      if (referencedCommands.has(file)) {
        registered.push(relativePath);
      } else {
        unregistered.push(relativePath);
      }
    }

    return Result.ok({
      actionsDir,
      commandsDir,
      ok: unregistered.length === 0,
      registered,
      registeredCount: registered.length,
      totalCommands: commandFiles.length,
      unregistered,
      unregisteredCount: unregistered.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan action registry";
    return Result.err(new CheckActionRegistryError(message));
  }
}

/**
 * Render action registry scan results to stdout/stderr.
 *
 * Emits JSON/JSONL for structured modes or a human-readable summary
 * listing any unregistered command files.
 */
export async function printCheckActionRegistryResult(
  result: CheckActionRegistryResult,
  options?: { mode?: CliOutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    const serialized =
      structuredMode === "json"
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);
    process.stdout.write(`${serialized}\n`);
    return;
  }

  process.stdout.write(
    `[action-registry] scanned ${result.totalCommands} command files in ${result.commandsDir}\n`
  );
  process.stdout.write(
    `[action-registry] ${result.registeredCount} registered, ${result.unregisteredCount} unregistered\n`
  );

  if (result.unregistered.length === 0) {
    process.stdout.write(
      "[action-registry] all command files are referenced by action definitions\n"
    );
    return;
  }

  process.stderr.write("[action-registry] unregistered command files:\n");
  for (const file of result.unregistered) {
    process.stderr.write(`  - ${file}\n`);
  }
}

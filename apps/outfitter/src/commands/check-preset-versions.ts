import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Result } from "@outfitter/contracts";
import { getResolvedVersions } from "@outfitter/presets";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencySection = (typeof DEPENDENCY_SECTIONS)[number];

export interface CheckPresetVersionsOptions {
  readonly cwd: string;
}

export interface CheckPresetVersionsResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly workspaceRoot: string;
}

export class CheckPresetVersionsError extends Error {
  readonly _tag = "CheckPresetVersionsError" as const;

  constructor(message: string) {
    super(message);
    this.name = "CheckPresetVersionsError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeVersionRange(version: string): string {
  const trimmed = version.trim();
  const semverMatch = trimmed.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
  if (semverMatch) {
    return semverMatch[0];
  }
  return trimmed.replace(/^[\^~>=<]+/, "");
}

function validatePresetDeps(
  workspaceRoot: string,
  resolvedVersions: Readonly<Record<string, string>>,
  problems: string[]
): void {
  const templateRoots = ["templates", "packages/presets/presets"] as const;
  const glob = new Bun.Glob("**/package.json.template");

  for (const rootPath of templateRoots) {
    const absoluteRoot = join(workspaceRoot, rootPath);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    for (const relativePath of glob.scanSync({
      cwd: absoluteRoot,
      absolute: false,
    })) {
      const templatePath = join(rootPath, relativePath);
      const absoluteTemplatePath = join(absoluteRoot, relativePath);
      const parsed: unknown = JSON.parse(
        readFileSync(absoluteTemplatePath, "utf-8")
      );
      if (!isRecord(parsed)) {
        continue;
      }

      for (const section of DEPENDENCY_SECTIONS) {
        const deps = parsed[section];
        if (!isRecord(deps)) {
          continue;
        }

        for (const [name, value] of Object.entries(deps)) {
          if (typeof value !== "string") {
            continue;
          }

          if (name.startsWith("@outfitter/")) {
            if (value !== "workspace:*") {
              problems.push(
                `${templatePath}: ${name} must use workspace:* (found ${value})`
              );
            }
            continue;
          }

          if (name.includes("{{") || value.startsWith("workspace:")) {
            continue;
          }

          const expected = resolvedVersions[name];
          if (!expected) {
            problems.push(
              `${templatePath}: external dependency "${name}" is not declared in @outfitter/presets`
            );
            continue;
          }

          if (
            normalizeVersionRange(value) !== normalizeVersionRange(expected)
          ) {
            problems.push(
              `${templatePath}: ${name} expected ${expected} (found ${value})`
            );
          }
        }
      }
    }
  }
}

function validateRegistryVersions(
  workspaceRoot: string,
  resolvedVersions: Readonly<Record<string, string>>,
  problems: string[]
): void {
  const registryPath = "packages/tooling/registry/registry.json";
  const absoluteRegistryPath = join(workspaceRoot, registryPath);

  let registry: unknown;
  try {
    registry = JSON.parse(readFileSync(absoluteRegistryPath, "utf-8"));
  } catch {
    problems.push(`Registry not found or unreadable: ${registryPath}`);
    return;
  }

  if (!isRecord(registry)) {
    problems.push(
      `Registry has invalid shape (expected object): ${registryPath}`
    );
    return;
  }

  if (!isRecord(registry["blocks"])) {
    problems.push(
      `Registry has invalid shape (missing object "blocks" field): ${registryPath}`
    );
    return;
  }

  for (const [blockName, block] of Object.entries(registry["blocks"])) {
    if (!isRecord(block)) {
      continue;
    }

    const devDeps = block["devDependencies"];
    if (!isRecord(devDeps)) {
      continue;
    }

    for (const [name, value] of Object.entries(devDeps)) {
      if (typeof value !== "string") {
        continue;
      }

      if (name.startsWith("@outfitter/")) {
        continue;
      }

      const expected = resolvedVersions[name];
      if (
        expected &&
        normalizeVersionRange(value) !== normalizeVersionRange(expected)
      ) {
        problems.push(
          `registry block "${blockName}": ${name} expected ${expected} (found ${value})`
        );
      }
    }
  }
}

function readDependencyVersion(
  packageJson: Record<string, unknown>,
  section: DependencySection,
  name: string
): string | undefined {
  const container = packageJson[section];
  if (!isRecord(container)) {
    return undefined;
  }

  const value = container[name];
  return typeof value === "string" ? value : undefined;
}

function validateBunVersionConsistency(
  workspaceRoot: string,
  problems: string[]
): void {
  const bunVersionPath = join(workspaceRoot, ".bun-version");
  const bunVersionFile = readFileSync(bunVersionPath, "utf-8").trim();

  const rootPackagePath = join(workspaceRoot, "package.json");
  const parsedRootPackage = JSON.parse(
    readFileSync(rootPackagePath, "utf-8")
  ) as unknown;
  if (!isRecord(parsedRootPackage)) {
    return;
  }

  const engines = parsedRootPackage["engines"];
  if (isRecord(engines) && typeof engines["bun"] === "string") {
    const engineBun = normalizeVersionRange(engines["bun"]);
    if (engineBun !== bunVersionFile) {
      problems.push(
        `Bun version drift: .bun-version is ${bunVersionFile} but engines.bun is ${engines["bun"]}`
      );
    }
  }

  let bunTypesVersion: string | undefined;
  const catalog = parsedRootPackage["catalog"];
  if (isRecord(catalog) && typeof catalog["@types/bun"] === "string") {
    bunTypesVersion = catalog["@types/bun"];
  }

  if (!bunTypesVersion) {
    bunTypesVersion =
      readDependencyVersion(
        parsedRootPackage,
        "devDependencies",
        "@types/bun"
      ) ?? undefined;
  }

  if (
    bunTypesVersion &&
    normalizeVersionRange(bunTypesVersion) !== bunVersionFile
  ) {
    problems.push(
      `Bun version drift: .bun-version is ${bunVersionFile} but @types/bun is ${bunTypesVersion}`
    );
  }

  const docsToValidate = ["README.md", "apps/outfitter/README.md"] as const;
  for (const docPath of docsToValidate) {
    const absoluteDocPath = join(workspaceRoot, docPath);
    if (!existsSync(absoluteDocPath)) {
      continue;
    }

    const content = readFileSync(absoluteDocPath, "utf-8");
    const match = content.match(/\bbun\b\s*(?:>=|>|=)\s*([\d.]+)/i);
    if (match && match[1] !== bunVersionFile) {
      problems.push(
        `Bun version drift: ${docPath} references Bun ${match[1]} but .bun-version is ${bunVersionFile}`
      );
    }
  }
}

function validateNoStaleFallbacks(
  workspaceRoot: string,
  problems: string[]
): void {
  const filesToCheck = [
    "apps/outfitter/src/commands/shared-deps.ts",
    "packages/tooling/src/registry/build.ts",
  ] as const;

  const fallbackPattern = /(?:\?\?|\|\|)\s*["']\^?[\d]+\.[\d]+\.[\d]+["']/;

  for (const filePath of filesToCheck) {
    const absoluteFilePath = join(workspaceRoot, filePath);
    if (!existsSync(absoluteFilePath)) {
      continue;
    }

    const content = readFileSync(absoluteFilePath, "utf-8");
    for (const [index, line] of content.split("\n").entries()) {
      if (fallbackPattern.test(line)) {
        problems.push(
          `stale fallback: ${filePath}:${index + 1} contains hardcoded version fallback`
        );
      }
    }
  }
}

export async function runCheckPresetVersions(
  options: CheckPresetVersionsOptions
): Promise<Result<CheckPresetVersionsResult, CheckPresetVersionsError>> {
  try {
    const workspaceRoot = resolve(options.cwd);
    const { all: resolvedVersions } = getResolvedVersions();
    const problems: string[] = [];

    validatePresetDeps(workspaceRoot, resolvedVersions, problems);
    validateRegistryVersions(workspaceRoot, resolvedVersions, problems);
    validateBunVersionConsistency(workspaceRoot, problems);
    validateNoStaleFallbacks(workspaceRoot, problems);

    return Result.ok({
      workspaceRoot,
      problems,
      ok: problems.length === 0,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to check preset versions";
    return Result.err(new CheckPresetVersionsError(message));
  }
}

export async function printCheckPresetVersionsResult(
  result: CheckPresetVersionsResult,
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

  if (result.ok) {
    process.stdout.write("All version checks passed.\n");
    return;
  }

  process.stderr.write(
    `Version drift detected (${result.problems.length} issue(s)):\n`
  );
  for (const problem of result.problems) {
    process.stderr.write(`- ${problem}\n`);
  }
}

interface ParsedCliArgs {
  readonly cwd: string;
  readonly outputMode: CliOutputMode;
}

function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  let cwd = process.cwd();
  let outputMode: CliOutputMode = "human";

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--cwd") {
      const value = argv[index + 1];
      if (!value) {
        throw new CheckPresetVersionsError("Missing value for --cwd");
      }
      cwd = value;
      index += 1;
      continue;
    }

    if (arg === "--json") {
      outputMode = "json";
      continue;
    }

    if (arg === "--jsonl") {
      outputMode = "jsonl";
      continue;
    }
  }

  return {
    cwd: resolve(cwd),
    outputMode,
  };
}

export async function runCheckPresetVersionsFromArgv(
  argv: readonly string[]
): Promise<number> {
  let parsed: ParsedCliArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid command arguments";
    process.stderr.write(`${message}\n`);
    return 1;
  }

  const result = await runCheckPresetVersions({ cwd: parsed.cwd });
  if (result.isErr()) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  await printCheckPresetVersionsResult(result.value, {
    mode: parsed.outputMode,
  });
  return result.value.ok ? 0 : 1;
}

if (import.meta.main) {
  void runCheckPresetVersionsFromArgv(process.argv.slice(2)).then(
    (exitCode) => {
      process.exit(exitCode);
    }
  );
}

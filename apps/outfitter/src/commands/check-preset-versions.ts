import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { extractMessage, Result } from "@outfitter/contracts";
import { getResolvedVersions } from "@outfitter/presets";
import { isTypesBunVersionCompatible } from "@outfitter/tooling";
import { isPlainObject } from "@outfitter/types";

import {
  DEPENDENCY_SECTIONS,
  normalizeVersionRange,
} from "../engine/dependency-versions.js";
import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";

export const EXTERNAL_TEMPLATE_VERSION = "catalog:";

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

export function validatePresetDeps(
  workspaceRoot: string,
  resolvedVersions: Readonly<Record<string, string>>,
  problems: string[]
): void {
  const presetRoot = "packages/presets/presets";
  const glob = new Bun.Glob("**/package.template.json");

  const absoluteRoot = join(workspaceRoot, presetRoot);
  if (!existsSync(absoluteRoot)) {
    problems.push(`Canonical presets root not found: ${presetRoot}`);
    return;
  }

  for (const relativePath of glob.scanSync({
    cwd: absoluteRoot,
    absolute: false,
  })) {
    const templatePath = join(presetRoot, relativePath);
    const absoluteTemplatePath = join(absoluteRoot, relativePath);
    const parsed: unknown = JSON.parse(
      readFileSync(absoluteTemplatePath, "utf-8")
    );
    if (!isPlainObject(parsed)) {
      continue;
    }

    for (const section of DEPENDENCY_SECTIONS) {
      const deps = parsed[section];
      if (!isPlainObject(deps)) {
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

        if (value !== EXTERNAL_TEMPLATE_VERSION) {
          problems.push(
            `${templatePath}: ${name} must use ${EXTERNAL_TEMPLATE_VERSION} (found ${value})`
          );
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

  if (!isPlainObject(registry)) {
    problems.push(
      `Registry has invalid shape (expected object): ${registryPath}`
    );
    return;
  }

  if (!isPlainObject(registry["blocks"])) {
    problems.push(
      `Registry has invalid shape (missing object "blocks" field): ${registryPath}`
    );
    return;
  }

  for (const [blockName, block] of Object.entries(registry["blocks"])) {
    if (!isPlainObject(block)) {
      continue;
    }

    const devDeps = block["devDependencies"];
    if (!isPlainObject(devDeps)) {
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
  if (!isPlainObject(container)) {
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
  let bunVersionFile: string;
  try {
    bunVersionFile = readFileSync(bunVersionPath, "utf-8").trim();
  } catch (error) {
    problems.push(
      `.bun-version not found or unreadable: ${extractMessage(error)}`
    );
    return;
  }

  const rootPackagePath = join(workspaceRoot, "package.json");
  let parsedRootPackage: unknown;
  try {
    parsedRootPackage = JSON.parse(readFileSync(rootPackagePath, "utf-8"));
  } catch (error) {
    problems.push(
      `Root package.json could not be read or parsed: ${extractMessage(error)}`
    );
    return;
  }
  if (!isPlainObject(parsedRootPackage)) {
    return;
  }

  const engines = parsedRootPackage["engines"];
  if (isPlainObject(engines) && typeof engines["bun"] === "string") {
    const engineBun = normalizeVersionRange(engines["bun"]);
    if (engineBun !== bunVersionFile) {
      problems.push(
        `Bun version drift: .bun-version is ${bunVersionFile} but engines.bun is ${engines["bun"]}`
      );
    }
  }

  const packageManager = parsedRootPackage["packageManager"];
  if (typeof packageManager === "string" && packageManager.startsWith("bun@")) {
    const packageManagerVersion = normalizeVersionRange(packageManager);
    if (packageManagerVersion !== bunVersionFile) {
      problems.push(
        `Bun version drift: .bun-version is ${bunVersionFile} but packageManager is ${packageManager}`
      );
    }
  }

  let bunTypesVersion: string | undefined;
  const catalog = parsedRootPackage["catalog"];
  if (isPlainObject(catalog) && typeof catalog["@types/bun"] === "string") {
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

  if (bunTypesVersion) {
    const normalizedTypesVersion = normalizeVersionRange(bunTypesVersion);
    if (!isTypesBunVersionCompatible(bunVersionFile, normalizedTypesVersion)) {
      problems.push(
        `Bun version drift: .bun-version is ${bunVersionFile} but @types/bun is ${bunTypesVersion}`
      );
    }
  }

  const docsToValidate = [
    "README.md",
    "apps/outfitter/README.md",
    "docs/getting-started.md",
  ] as const;
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
    return Result.err(new CheckPresetVersionsError(extractMessage(error)));
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

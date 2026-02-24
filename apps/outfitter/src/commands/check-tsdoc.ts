/**
 * `outfitter check tsdoc` - Check TSDoc coverage on exported declarations.
 *
 * Delegates to the pure analysis function in `@outfitter/tooling`.
 * Resolves source entrypoints in monorepo dev to avoid requiring a build step.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { Result, ValidationError } from "@outfitter/contracts";
import type {
  CoverageLevel,
  DeclarationCoverage,
  PackageCoverage,
  TsDocCheckResult,
} from "@outfitter/tooling";

import type { CliOutputMode } from "../output-mode.js";
import { applyJq } from "./jq-utils.js";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the check-tsdoc action handler. */
export interface CheckTsDocInput {
  readonly cwd: string;
  readonly emitOutput?: boolean;
  readonly jq: string | undefined;
  readonly level: CoverageLevel | undefined;
  readonly minCoverage: number;
  readonly outputMode: CliOutputMode;
  readonly packages: readonly string[];
  readonly strict: boolean;
  readonly summary: boolean;
}

const DEFAULT_TSDOC_DISCOVERY_PATTERNS = [
  "packages/*/src/index.ts",
  "apps/*/src/index.ts",
  "src/index.ts",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate coverage statistics from declaration results.
 *
 * Matches `@outfitter/tooling` semantics where `partial` counts as half credit.
 */
function calculateCoverage(declarations: readonly DeclarationCoverage[]): {
  documented: number;
  partial: number;
  undocumented: number;
  total: number;
  percentage: number;
} {
  const total = declarations.length;
  if (total === 0) {
    return {
      documented: 0,
      partial: 0,
      undocumented: 0,
      total: 0,
      percentage: 100,
    };
  }

  const documented = declarations.filter(
    (d) => d.level === "documented"
  ).length;
  const partial = declarations.filter((d) => d.level === "partial").length;
  const undocumented = declarations.filter(
    (d) => d.level === "undocumented"
  ).length;

  const score = documented + partial * 0.5;
  const percentage = Math.round((score / total) * 100);

  return { documented, partial, undocumented, total, percentage };
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function readJsonFile(filePath: string): JsonRecord | undefined {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as JsonRecord;
  } catch {
    return undefined;
  }
}

function readEntrypointsFromTsdocObject(
  value: unknown
): readonly string[] | undefined {
  const tsdoc = asRecord(value);
  const entrypoints = tsdoc?.["entrypoints"];
  if (!Array.isArray(entrypoints)) {
    return undefined;
  }

  const normalized = entrypoints
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function resolveConfiguredEntrypoints(cwd: string): {
  readonly entrypoints: readonly string[];
  readonly source: string;
} | null {
  const configPath = join(cwd, ".outfitter", "config.json");
  if (existsSync(configPath)) {
    const parsed = readJsonFile(configPath);
    if (parsed) {
      const fromRoot = readEntrypointsFromTsdocObject(parsed["tsdoc"]);
      if (fromRoot) {
        return {
          entrypoints: fromRoot,
          source: ".outfitter/config.json#tsdoc.entrypoints",
        };
      }

      const fromOutfitter = readEntrypointsFromTsdocObject(
        asRecord(parsed["outfitter"])?.["tsdoc"]
      );
      if (fromOutfitter) {
        return {
          entrypoints: fromOutfitter,
          source: ".outfitter/config.json#outfitter.tsdoc.entrypoints",
        };
      }
    }
  }

  const packageJsonPath = join(cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  const parsedPackageJson = readJsonFile(packageJsonPath);
  const fromPackageJson = readEntrypointsFromTsdocObject(
    asRecord(parsedPackageJson?.["outfitter"])?.["tsdoc"]
  );
  if (!fromPackageJson) {
    return null;
  }

  return {
    entrypoints: fromPackageJson,
    source: "package.json#outfitter.tsdoc.entrypoints",
  };
}

function derivePackagePathFromEntrypoint(match: string): string {
  const normalized = match.replaceAll("\\", "/");
  if (normalized === "src/index.ts") {
    return ".";
  }
  if (normalized.endsWith("/src/index.ts")) {
    return normalized.slice(0, -"/src/index.ts".length);
  }

  const srcSegment = normalized.lastIndexOf("/src/");
  if (srcSegment >= 0) {
    return srcSegment === 0 ? "." : normalized.slice(0, srcSegment);
  }

  const separator = normalized.lastIndexOf("/");
  return separator > 0 ? normalized.slice(0, separator) : ".";
}

function discoverPathsFromEntrypoints(
  cwd: string,
  entrypoints: readonly string[]
): readonly string[] {
  const paths = new Set<string>();

  for (const pattern of entrypoints) {
    const glob = new Bun.Glob(pattern);
    for (const match of glob.scanSync({ cwd, dot: false })) {
      paths.add(derivePackagePathFromEntrypoint(match));
    }
  }

  return [...paths].sort();
}

function formatDiscoveryMessage(
  entrypoints: readonly string[],
  source?: string
): string {
  const patterns = entrypoints.join(", ");
  return source ? `${patterns} (from ${source})` : patterns;
}

/** Recalculate count fields from a declarations array. */
function recalculateCounts(
  pkg: PackageCoverage,
  declarations: readonly DeclarationCoverage[]
): PackageCoverage {
  const coverage = calculateCoverage(declarations);
  return {
    ...pkg,
    declarations,
    ...coverage,
  };
}

/**
 * Apply `--level` and `--package` filters and recompute aggregate fields.
 *
 * `ok` is recomputed from the filtered summary when strict mode is enabled.
 */
function filterResult(
  result: TsDocCheckResult,
  options: {
    level: CoverageLevel | undefined;
    packageNames: readonly string[];
    strict: boolean;
    minCoverage: number;
  }
): TsDocCheckResult {
  let packages = [...result.packages];

  if (options.packageNames.length > 0) {
    const names = new Set(options.packageNames);
    packages = packages.filter((pkg) => names.has(pkg.name));
  }

  if (options.level) {
    packages = packages.map((pkg) => {
      const declarations = pkg.declarations.filter(
        (d) => d.level === options.level
      );
      return recalculateCounts(pkg, declarations);
    });
  }

  const summary = calculateCoverage(
    packages.flatMap((pkg) => pkg.declarations)
  );
  const ok = options.strict ? summary.percentage >= options.minCoverage : true;

  return {
    ok,
    packages,
    summary,
  };
}

/**
 * Strip declaration detail for compact output while preserving schema shape.
 *
 * This keeps `check.tsdoc` output contract-compatible in JSON/JQ modes.
 */
function summarizeResult(result: TsDocCheckResult): TsDocCheckResult {
  return {
    ok: result.ok,
    packages: result.packages.map((pkg) => ({
      ...pkg,
      declarations: [],
    })),
    summary: result.summary,
  };
}

/**
 * Emit type-discriminated JSONL lines for progressive consumption.
 *
 * Line order: meta -> summary -> package (per pkg) -> declaration (per decl).
 * When `summary` is true, declaration lines are suppressed.
 */
function emitJsonlLines(result: TsDocCheckResult, summary: boolean): unknown[] {
  const lines: unknown[] = [];

  lines.push({ type: "meta", version: "1.0.0", ok: result.ok });
  lines.push({ type: "summary", ...result.summary });

  const sortedPackages = [...result.packages].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const pkg of sortedPackages) {
    lines.push({
      type: "package",
      name: pkg.name,
      percentage: pkg.percentage,
      documented: pkg.documented,
      partial: pkg.partial,
      undocumented: pkg.undocumented,
      total: pkg.total,
    });
  }

  if (!summary) {
    for (const pkg of sortedPackages) {
      for (const decl of pkg.declarations) {
        lines.push({
          type: "declaration",
          package: pkg.name,
          name: decl.name,
          kind: decl.kind,
          level: decl.level,
          file: relative(pkg.path, decl.file),
          line: decl.line,
        });
      }
    }
  }

  return lines;
}

/** Ensure each emitted JSONL record is a single compact line of valid JSON. */
function normalizeJsonlRecord(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return JSON.stringify(text);
  }
}

type ToolingCheckTsdocModule = Pick<
  typeof import("@outfitter/tooling"),
  "analyzeCheckTsdoc" | "printCheckTsdocHuman"
>;

let toolingCheckTsdocModule: Promise<ToolingCheckTsdocModule> | undefined;

/**
 * Resolve the `@outfitter/tooling` entrypoint.
 *
 * Prefers source in monorepo development to avoid requiring dist builds.
 */
function resolveToolingEntrypoint(): string {
  const packageJsonPath = require.resolve("@outfitter/tooling/package.json");
  const packageRoot = dirname(packageJsonPath);

  const srcEntrypoint = join(packageRoot, "src", "index.ts");
  if (existsSync(srcEntrypoint)) {
    return srcEntrypoint;
  }

  const distEntrypoint = join(packageRoot, "dist", "index.js");
  if (existsSync(distEntrypoint)) {
    return distEntrypoint;
  }

  throw new Error(
    "Unable to resolve @outfitter/tooling entrypoint (expected src/index.ts or dist/index.js)."
  );
}

function loadToolingCheckTsdocModule(): Promise<ToolingCheckTsdocModule> {
  if (!toolingCheckTsdocModule) {
    toolingCheckTsdocModule = import(
      pathToFileURL(resolveToolingEntrypoint()).href
    ) as Promise<ToolingCheckTsdocModule>;
  }

  return toolingCheckTsdocModule;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run TSDoc coverage analysis and format output.
 *
 * @param input - Validated action input
 * @returns Result containing the coverage analysis
 */
export async function runCheckTsdoc(
  input: CheckTsDocInput
): Promise<Result<TsDocCheckResult, Error>> {
  try {
    const tooling = await loadToolingCheckTsdocModule();
    const configuredEntrypoints = resolveConfiguredEntrypoints(input.cwd);
    const configuredPaths = configuredEntrypoints
      ? discoverPathsFromEntrypoints(
          input.cwd,
          configuredEntrypoints.entrypoints
        )
      : [];

    if (configuredEntrypoints && configuredPaths.length === 0) {
      return Result.err(
        ValidationError.fromMessage(
          `No packages found. Searched ${formatDiscoveryMessage(
            configuredEntrypoints.entrypoints,
            configuredEntrypoints.source
          )}.`,
          { cwd: input.cwd }
        )
      );
    }

    const rawResult = tooling.analyzeCheckTsdoc({
      strict: input.strict,
      minCoverage: input.minCoverage,
      cwd: input.cwd,
      ...(configuredEntrypoints ? { paths: configuredPaths } : {}),
    });

    if (!rawResult) {
      const discoveryPatterns = configuredEntrypoints
        ? configuredEntrypoints.entrypoints
        : DEFAULT_TSDOC_DISCOVERY_PATTERNS;
      const discoverySource = configuredEntrypoints?.source;

      return Result.err(
        ValidationError.fromMessage(
          `No packages found. Searched ${formatDiscoveryMessage(
            discoveryPatterns,
            discoverySource
          )}. Use --package <path> to specify explicitly.`,
          { cwd: input.cwd }
        )
      );
    }

    const hasFilters = input.level !== undefined || input.packages.length > 0;
    const filteredResult = hasFilters
      ? filterResult(rawResult, {
          level: input.level,
          packageNames: input.packages,
          strict: input.strict,
          minCoverage: input.minCoverage,
        })
      : rawResult;

    const outputData = input.summary
      ? summarizeResult(filteredResult)
      : filteredResult;

    if (input.emitOutput !== false) {
      if (input.outputMode === "jsonl") {
        const lines = emitJsonlLines(filteredResult, input.summary);

        if (input.jq) {
          for (const line of lines) {
            const filtered = await applyJq(line, input.jq, { compact: true });
            for (const rawLine of filtered.split(/\r?\n/)) {
              const trimmed = rawLine.trim();
              if (!trimmed) {
                continue;
              }
              process.stdout.write(`${normalizeJsonlRecord(trimmed)}\n`);
            }
          }
        } else {
          for (const line of lines) {
            process.stdout.write(`${JSON.stringify(line)}\n`);
          }
        }
      } else if (input.jq) {
        const filtered = await applyJq(outputData, input.jq);
        process.stdout.write(filtered);
      } else if (input.outputMode === "json") {
        process.stdout.write(`${JSON.stringify(outputData, null, 2)}\n`);
      } else {
        tooling.printCheckTsdocHuman(outputData, {
          strict: input.strict,
          minCoverage: input.minCoverage,
        });
      }
    }

    return Result.ok(outputData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run check-tsdoc";
    return Result.err(new Error(message));
  }
}

/**
 * Filesystem helpers for the check-exports command.
 *
 * Package.json reading, source entry discovery, export map computation,
 * and config file export derivation. Depends on Bun filesystem APIs.
 *
 * @packageDocumentation
 */

import type { ExportMap } from "./exports-analysis.js";
import { entryToSubpath } from "./exports-analysis.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Bunup workspace entry from bunup.config.ts */
export interface WorkspaceEntry {
  readonly name: string;
  readonly root: string;
  readonly config?: {
    readonly exports?:
      | boolean
      | {
          readonly exclude?: readonly string[];
          readonly customExports?: Readonly<Record<string, string>>;
        };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a subpath matches any exclude pattern using Bun.Glob */
function matchesExclude(subpath: string, excludes: readonly string[]): boolean {
  return excludes.some((pattern) => new Bun.Glob(pattern).match(subpath));
}

/**
 * Bunup CLI exclusion patterns — entry files matching these are excluded
 * from the generated exports map (they are bin entrypoints, not library exports).
 */
const CLI_EXCLUSION_PATTERNS = [
  "**/cli.ts",
  "**/cli/index.ts",
  "**/bin.ts",
  "**/bin/index.ts",
] as const;

/** Check if a source entry is a CLI entrypoint per bunup convention */
function isCliEntrypoint(entry: string): boolean {
  return CLI_EXCLUSION_PATTERNS.some((pattern) =>
    new Bun.Glob(pattern).match(entry)
  );
}

/** Build a standard bunup export entry from a source entry path */
function buildExportValue(entry: string): {
  import: { types: string; default: string };
} {
  // Strip src/ prefix and .ts extension, keep directory structure
  const distPath = entry.replace(/^src\//, "").replace(/\.[cm]?[jt]sx?$/, "");
  return {
    import: {
      types: `./dist/${distPath}.d.ts`,
      default: `./dist/${distPath}.js`,
    },
  };
}

/** Discover source entry files for a workspace package */
function discoverEntries(packageRoot: string): string[] {
  const glob = new Bun.Glob("src/**/*.ts");
  const entries: string[] = [];

  for (const match of glob.scanSync({ cwd: packageRoot, dot: false })) {
    if (match.includes("__tests__") || match.endsWith(".test.ts")) {
      continue;
    }
    entries.push(match);
  }

  return entries.toSorted();
}

/**
 * Add config file exports derived from the `files` array in package.json.
 *
 * Replicates the logic from `scripts/sync-exports.ts`: config files
 * (json, jsonc, yml, yaml, toml) get two exports each — a full-filename
 * export and a short alias without the extension/preset suffix.
 */
function addConfigFileExports(
  expected: ExportMap,
  pkg: { files?: string[] }
): void {
  const CONFIG_RE = /\.(json|jsonc|yml|yaml|toml)$/;

  const configFiles = (pkg.files ?? []).filter(
    (file) => CONFIG_RE.test(file) && file !== "package.json"
  );

  for (const file of configFiles) {
    // Full filename export
    expected[`./${file}`] = `./${file}`;

    // Short alias: strip extension, normalize .preset.variant -> name-variant
    let base = file.replace(CONFIG_RE, "");
    const match = base.match(/^(.+)\.preset(?:\.(.+))?$/);
    if (match?.[1]) {
      base = match[2] ? `${match[1]}-${match[2]}` : match[1];
    }
    if (base !== file) {
      expected[`./${base}`] = `./${file}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/** Compute expected exports for a workspace package */
export function computeExpectedExports(
  packageRoot: string,
  workspace: WorkspaceEntry,
  pkg: { files?: string[] }
): ExportMap {
  const entries = discoverEntries(packageRoot);
  const exportsConfig =
    typeof workspace.config?.exports === "object"
      ? workspace.config.exports
      : undefined;

  const excludes: readonly string[] = exportsConfig?.exclude ?? [];
  const customExports: Readonly<Record<string, string>> =
    exportsConfig?.customExports ?? {};

  const expected: ExportMap = {};

  // Source-derived exports
  // Track subpath -> entry mapping to resolve conflicts:
  // When both foo.ts and foo/index.ts exist, bunup prefers foo.ts
  const subpathEntries = new Map<string, string>();
  for (const entry of entries) {
    // Skip CLI entrypoints (bunup excludes these by default)
    if (isCliEntrypoint(entry)) continue;

    const subpath = entryToSubpath(entry);
    // Skip user-configured exclusions
    if (matchesExclude(subpath, excludes)) continue;

    const existing = subpathEntries.get(subpath);
    if (existing) {
      // Prefer direct file (foo.ts) over directory index (foo/index.ts)
      if (!existing.endsWith("/index.ts") && entry.endsWith("/index.ts")) {
        continue;
      }
    }
    subpathEntries.set(subpath, entry);
  }

  for (const [subpath, entry] of subpathEntries) {
    expected[subpath] = buildExportValue(entry);
  }

  // Custom static exports from bunup config
  for (const [key, value] of Object.entries(customExports)) {
    expected[`./${key.replace(/^\.\//, "")}`] = value;
  }

  // Config file exports from the files array (sync-exports convention)
  addConfigFileExports(expected, pkg);

  // Bunup always includes ./package.json
  expected["./package.json"] = "./package.json";

  return expected;
}

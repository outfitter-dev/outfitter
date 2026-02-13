/**
 * Check-exports command — validates package.json exports are in sync with source.
 *
 * Pure core functions for comparing export maps. The CLI runner in
 * {@link runCheckExports} handles filesystem discovery and output.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A package.json export map: keys are subpaths, values are export conditions or strings */
export type ExportMap = Record<string, unknown>;

/** Describes drift between expected and actual exports for a single package */
export interface ExportDrift {
	readonly package: string;
	readonly path: string;
	readonly added: string[];
	readonly removed: string[];
	readonly changed: Array<{
		readonly key: string;
		readonly expected: unknown;
		readonly actual: unknown;
	}>;
}

/** Per-package comparison result */
export interface PackageResult {
	readonly name: string;
	readonly status: "ok" | "drift";
	readonly drift?: ExportDrift;
}

/** Aggregated result across all checked packages */
export interface CheckResult {
	readonly ok: boolean;
	readonly packages: PackageResult[];
}

/** Input for comparing a single package's exports */
export interface CompareInput {
	readonly name: string;
	readonly actual: ExportMap;
	readonly expected: ExportMap;
	readonly path?: string;
}

/** Bunup workspace entry from bunup.config.ts */
interface WorkspaceEntry {
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
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Convert a source entry file path to its export subpath.
 *
 * @example
 * entryToSubpath("src/index.ts")       // "."
 * entryToSubpath("src/branded.ts")     // "./branded"
 * entryToSubpath("src/cli/index.ts")   // "./cli"
 * entryToSubpath("src/cli/check.ts")   // "./cli/check"
 */
export function entryToSubpath(entry: string): string {
	// Strip src/ prefix and .ts extension
	const stripped = entry.replace(/^src\//, "").replace(/\.[cm]?[jt]sx?$/, "");

	// index at root -> "."
	if (stripped === "index") {
		return ".";
	}

	// dir/index -> ./dir
	if (stripped.endsWith("/index")) {
		return `./${stripped.slice(0, -"/index".length)}`;
	}

	return `./${stripped}`;
}

/**
 * Compare actual vs expected exports for a single package.
 *
 * Returns a PackageResult with status "ok" or "drift" and detailed diff.
 */
export function compareExports(input: CompareInput): PackageResult {
	const { name, actual, expected, path } = input;

	const actualKeys = new Set(Object.keys(actual));
	const expectedKeys = new Set(Object.keys(expected));

	const added: string[] = [];
	const removed: string[] = [];
	const changed: Array<{
		readonly key: string;
		readonly expected: unknown;
		readonly actual: unknown;
	}> = [];

	// Keys in expected but not in actual
	for (const key of expectedKeys) {
		if (!actualKeys.has(key)) {
			added.push(key);
		}
	}

	// Keys in actual but not in expected
	for (const key of actualKeys) {
		if (!expectedKeys.has(key)) {
			removed.push(key);
		}
	}

	// Keys in both but with different values
	for (const key of actualKeys) {
		if (expectedKeys.has(key)) {
			const actualValue = actual[key];
			const expectedValue = expected[key];
			if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
				changed.push({ key, expected: expectedValue, actual: actualValue });
			}
		}
	}

	// Sort for deterministic output
	added.sort();
	removed.sort();
	changed.sort((a, b) => a.key.localeCompare(b.key));

	if (added.length === 0 && removed.length === 0 && changed.length === 0) {
		return { name, status: "ok" };
	}

	return {
		name,
		status: "drift",
		drift: {
			package: name,
			path: path ?? "",
			added,
			removed,
			changed,
		},
	};
}

// ---------------------------------------------------------------------------
// Filesystem helpers (used by runner)
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
		new Bun.Glob(pattern).match(entry),
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

	return entries.sort();
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
	pkg: { files?: string[] },
): void {
	const CONFIG_RE = /\.(json|jsonc|yml|yaml|toml)$/;

	const configFiles = (pkg.files ?? []).filter(
		(file) => CONFIG_RE.test(file) && file !== "package.json",
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

/** Compute expected exports for a workspace package */
function computeExpectedExports(
	packageRoot: string,
	workspace: WorkspaceEntry,
	pkg: { files?: string[] },
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

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	dim: "\x1b[2m",
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface CheckExportsOptions {
	readonly json?: boolean;
}

/**
 * Run check-exports across all workspace packages.
 *
 * Reads the bunup workspace config to discover packages and their export
 * settings, then compares expected vs actual exports in each package.json.
 */
export async function runCheckExports(
	options: CheckExportsOptions = {},
): Promise<void> {
	const cwd = process.cwd();
	const configPath = resolve(cwd, "bunup.config.ts");

	let workspaces: WorkspaceEntry[];
	try {
		const configModule = await import(configPath);
		const rawConfig: unknown = configModule.default;
		if (!Array.isArray(rawConfig)) {
			process.stderr.write("bunup.config.ts must export a workspace array\n");
			process.exit(1);
		}
		workspaces = rawConfig as WorkspaceEntry[];
	} catch {
		process.stderr.write(`Could not load bunup.config.ts from ${cwd}\n`);
		process.exit(1);
	}

	const results: PackageResult[] = [];

	for (const workspace of workspaces) {
		const packageRoot = resolve(cwd, workspace.root);
		const pkgPath = resolve(packageRoot, "package.json");

		let pkg: { name?: string; exports?: ExportMap; files?: string[] };
		try {
			pkg = await Bun.file(pkgPath).json();
		} catch {
			results.push({ name: workspace.name, status: "ok" });
			continue;
		}

		const actual: ExportMap =
			typeof pkg.exports === "object" && pkg.exports !== null
				? (pkg.exports as ExportMap)
				: {};
		const expected = computeExpectedExports(packageRoot, workspace, pkg);

		results.push(
			compareExports({
				name: workspace.name,
				actual,
				expected,
				path: workspace.root,
			}),
		);
	}

	const checkResult: CheckResult = {
		ok: results.every((r) => r.status === "ok"),
		packages: results,
	};

	if (options.json) {
		process.stdout.write(`${JSON.stringify(checkResult, null, 2)}\n`);
	} else {
		const drifted = results.filter((r) => r.status === "drift");

		if (drifted.length === 0) {
			process.stdout.write(
				`${COLORS.green}All ${results.length} packages have exports in sync.${COLORS.reset}\n`,
			);
		} else {
			process.stderr.write(
				`${COLORS.red}Export drift detected in ${drifted.length} package(s):${COLORS.reset}\n\n`,
			);

			for (const result of drifted) {
				const drift = result.drift;
				if (!drift) continue;

				process.stderr.write(
					`  ${COLORS.yellow}${result.name}${COLORS.reset} ${COLORS.dim}(${drift.path})${COLORS.reset}\n`,
				);

				for (const key of drift.added) {
					process.stderr.write(
						`    ${COLORS.green}+ ${key}${COLORS.reset}  ${COLORS.dim}(missing from package.json)${COLORS.reset}\n`,
					);
				}
				for (const key of drift.removed) {
					process.stderr.write(
						`    ${COLORS.red}- ${key}${COLORS.reset}  ${COLORS.dim}(not in source)${COLORS.reset}\n`,
					);
				}
				for (const entry of drift.changed) {
					process.stderr.write(
						`    ${COLORS.yellow}~ ${entry.key}${COLORS.reset}  ${COLORS.dim}(value mismatch)${COLORS.reset}\n`,
					);
				}
				process.stderr.write("\n");
			}

			process.stderr.write(
				`Run ${COLORS.blue}bun run build${COLORS.reset} to regenerate exports.\n`,
			);
		}
	}

	process.exit(checkResult.ok ? 0 : 1);
}

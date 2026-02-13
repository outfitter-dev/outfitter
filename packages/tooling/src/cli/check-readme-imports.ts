/**
 * Check-readme-imports command — validates README import examples against package.json exports.
 *
 * Pure core functions for extracting and validating import specifiers from
 * markdown code blocks. The CLI runner in {@link runCheckReadmeImports}
 * handles filesystem discovery and output.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import type { ExportMap } from "./check-exports.js";

export type { ExportMap };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An import example extracted from a markdown code block */
export interface ImportExample {
	/** Package name, e.g. "@outfitter/cli" */
	readonly packageName: string;
	/** Export subpath, e.g. "./output" or "." */
	readonly subpath: string;
	/** Full import specifier, e.g. "@outfitter/cli/output" */
	readonly fullSpecifier: string;
	/** File where the import was found */
	readonly file: string;
	/** 1-based line number */
	readonly line: number;
}

/** Result of checking imports in a single file */
export interface ImportCheckResult {
	readonly file: string;
	readonly valid: ImportExample[];
	readonly invalid: ImportExample[];
}

// ---------------------------------------------------------------------------
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Parse a full import specifier into package name and subpath.
 *
 * Only recognizes `@outfitter/*` scoped packages.
 *
 * @example
 * parseSpecifier("@outfitter/cli/output")
 * // { packageName: "@outfitter/cli", subpath: "./output" }
 *
 * parseSpecifier("@outfitter/contracts")
 * // { packageName: "@outfitter/contracts", subpath: "." }
 */
export function parseSpecifier(
	specifier: string,
): { packageName: string; subpath: string } | null {
	if (!specifier.startsWith("@outfitter/")) {
		return null;
	}

	// @outfitter/cli/output -> ["@outfitter", "cli", "output"]
	const parts = specifier.split("/");
	if (parts.length < 2) {
		return null;
	}

	const packageName = `${parts[0]}/${parts[1]}`;
	const rest = parts.slice(2);

	if (rest.length === 0) {
		return { packageName, subpath: "." };
	}

	return { packageName, subpath: `./${rest.join("/")}` };
}

/**
 * Extract import specifiers from markdown content.
 *
 * Only extracts imports from fenced code blocks (typescript, ts,
 * javascript, js). Skips blocks preceded by a non-contractual HTML comment.
 * Deduplicates by full specifier within a single file.
 */
export function extractImports(content: string, file: string): ImportExample[] {
	const lines = content.split("\n");
	const results: ImportExample[] = [];
	const seen = new Set<string>();

	const CODE_FENCE_OPEN = /^```(?:typescript|ts|javascript|js)\s*$/;
	const CODE_FENCE_CLOSE = /^```\s*$/;
	const IMPORT_RE = /from\s+["'](@outfitter\/[^"']+)["']/;
	const NON_CONTRACTUAL = /<!--\s*non-contractual\s*-->/;

	let inCodeBlock = false;
	let skipBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] as string;

		if (!inCodeBlock) {
			if (CODE_FENCE_OPEN.test(line)) {
				inCodeBlock = true;
				// Check if previous non-empty line is the non-contractual marker
				skipBlock = false;
				for (let j = i - 1; j >= 0; j--) {
					const prev = (lines[j] as string).trim();
					if (prev === "") continue;
					if (NON_CONTRACTUAL.test(prev)) {
						skipBlock = true;
					}
					break;
				}
			}
			continue;
		}

		// Inside a code block
		if (CODE_FENCE_CLOSE.test(line) && !CODE_FENCE_OPEN.test(line)) {
			inCodeBlock = false;
			skipBlock = false;
			continue;
		}

		if (skipBlock) continue;

		const match = IMPORT_RE.exec(line);
		if (!match?.[1]) continue;

		const fullSpecifier = match[1];
		if (seen.has(fullSpecifier)) continue;
		seen.add(fullSpecifier);

		const parsed = parseSpecifier(fullSpecifier);
		if (!parsed) continue;

		results.push({
			packageName: parsed.packageName,
			subpath: parsed.subpath,
			fullSpecifier,
			file,
			line: i + 1, // 1-based
		});
	}

	return results;
}

/**
 * Check whether a subpath exists in a package.json export map.
 */
export function isExportedSubpath(
	subpath: string,
	exports: ExportMap,
): boolean {
	return subpath in exports;
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

export interface CheckReadmeImportsOptions {
	readonly json?: boolean;
}

/**
 * Run check-readme-imports across all workspace packages.
 *
 * Finds README.md files in `packages/` and `docs/packages/`, extracts
 * import examples, and validates each subpath against the corresponding
 * package.json exports.
 */
export async function runCheckReadmeImports(
	options: CheckReadmeImportsOptions = {},
): Promise<void> {
	const cwd = process.cwd();

	// Discover README files
	const readmeGlob = new Bun.Glob("**/README.md");
	const readmeDirs = ["packages", "docs/packages"];
	const readmePaths: string[] = [];

	for (const dir of readmeDirs) {
		const fullDir = resolve(cwd, dir);
		try {
			for (const match of readmeGlob.scanSync({ cwd: fullDir, dot: false })) {
				// Only top-level READMEs in each package dir (depth 1)
				const segments = match.split("/");
				if (segments.length === 2 && segments[1] === "README.md") {
					readmePaths.push(resolve(fullDir, match));
				}
			}
		} catch {
			// Directory may not exist
		}
	}

	if (readmePaths.length === 0) {
		process.stdout.write("No README.md files found.\n");
		return;
	}

	// Cache loaded package.json exports
	const exportsCache = new Map<string, ExportMap>();

	async function getExportsForPackage(
		packageName: string,
	): Promise<ExportMap | null> {
		if (exportsCache.has(packageName)) {
			return exportsCache.get(packageName) ?? null;
		}

		// Derive package dir from name: @outfitter/cli -> packages/cli
		const shortName = packageName.replace("@outfitter/", "");
		const pkgPath = resolve(cwd, "packages", shortName, "package.json");

		try {
			const pkg: { exports?: ExportMap } = await Bun.file(pkgPath).json();
			const exports =
				typeof pkg.exports === "object" && pkg.exports !== null
					? pkg.exports
					: {};
			exportsCache.set(packageName, exports);
			return exports;
		} catch {
			return null;
		}
	}

	const results: ImportCheckResult[] = [];
	let hasInvalid = false;

	for (const readmePath of readmePaths.sort()) {
		const content = await Bun.file(readmePath).text();
		const relativePath = readmePath.replace(`${cwd}/`, "");
		const imports = extractImports(content, relativePath);

		if (imports.length === 0) continue;

		const valid: ImportExample[] = [];
		const invalid: ImportExample[] = [];

		for (const imp of imports) {
			const exports = await getExportsForPackage(imp.packageName);
			if (exports === null) {
				// Package not found in workspace — treat as invalid
				invalid.push(imp);
				continue;
			}

			if (isExportedSubpath(imp.subpath, exports)) {
				valid.push(imp);
			} else {
				invalid.push(imp);
			}
		}

		if (valid.length > 0 || invalid.length > 0) {
			results.push({ file: relativePath, valid, invalid });
		}

		if (invalid.length > 0) {
			hasInvalid = true;
		}
	}

	// Output
	if (options.json) {
		const output = {
			ok: !hasInvalid,
			files: results,
		};
		process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
	} else {
		const totalValid = results.reduce((n, r) => n + r.valid.length, 0);
		const totalInvalid = results.reduce((n, r) => n + r.invalid.length, 0);

		if (!hasInvalid) {
			process.stdout.write(
				`${COLORS.green}All ${totalValid} README import examples match package exports.${COLORS.reset}\n`,
			);
		} else {
			process.stderr.write(
				`${COLORS.red}Invalid README import examples found:${COLORS.reset}\n\n`,
			);

			for (const result of results) {
				if (result.invalid.length === 0) continue;

				process.stderr.write(
					`  ${COLORS.yellow}${result.file}${COLORS.reset}\n`,
				);

				for (const imp of result.invalid) {
					process.stderr.write(
						`    ${COLORS.red}line ${imp.line}:${COLORS.reset} ${imp.fullSpecifier}  ${COLORS.dim}(subpath ${imp.subpath} not in ${imp.packageName} exports)${COLORS.reset}\n`,
					);
				}

				process.stderr.write("\n");
			}

			process.stderr.write(
				`${totalInvalid} invalid, ${totalValid} valid across ${results.length} file(s).\n`,
			);
		}
	}

	process.exit(hasInvalid ? 1 : 0);
}

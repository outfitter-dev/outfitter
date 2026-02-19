/**
 * Check-tsdoc command -- validates TSDoc coverage on exported declarations.
 *
 * Pure core functions for analyzing TSDoc coverage across monorepo packages.
 * The CLI runner in {@link runCheckTsdoc} handles filesystem discovery and output.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import ts from "typescript";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Coverage classification for a single declaration. */
export type CoverageLevel = "documented" | "partial" | "undocumented";

/** Result for a single exported declaration. */
export interface DeclarationCoverage {
	readonly name: string;
	readonly kind: string;
	readonly level: CoverageLevel;
	readonly file: string;
	readonly line: number;
}

/** Per-package TSDoc coverage stats. */
export interface PackageCoverage {
	readonly name: string;
	readonly path: string;
	readonly declarations: readonly DeclarationCoverage[];
	readonly documented: number;
	readonly partial: number;
	readonly undocumented: number;
	readonly total: number;
	readonly percentage: number;
}

/** Aggregated result across all packages. */
export interface TsDocCheckResult {
	readonly ok: boolean;
	readonly packages: readonly PackageCoverage[];
	readonly summary: {
		readonly documented: number;
		readonly partial: number;
		readonly undocumented: number;
		readonly total: number;
		readonly percentage: number;
	};
}

/** Options for the check-tsdoc command. */
export interface CheckTsDocOptions {
	readonly strict?: boolean | undefined;
	readonly json?: boolean | undefined;
	readonly minCoverage?: number | undefined;
	readonly paths?: readonly string[] | undefined;
}

// ---------------------------------------------------------------------------
// Pure functions (tested directly)
// ---------------------------------------------------------------------------

/**
 * Check whether a node is an exported declaration worth checking.
 *
 * Returns true for function, interface, type alias, class, enum, and variable
 * declarations that carry the `export` keyword. Re-exports (`export { ... } from`)
 * and `export *` are excluded since TSDoc belongs at the definition site.
 */
export function isExportedDeclaration(node: ts.Node): boolean {
	// Exclude re-exports: export { ... } from "..."
	if (ts.isExportDeclaration(node)) return false;

	// Exclude export * from "..."
	if (ts.isExportAssignment(node)) return false;

	// Must be a supported declaration kind
	const isDeclaration =
		ts.isFunctionDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isClassDeclaration(node) ||
		ts.isEnumDeclaration(node) ||
		ts.isVariableStatement(node);

	if (!isDeclaration) return false;

	// Check for export modifier
	const modifiers = ts.canHaveModifiers(node)
		? ts.getModifiers(node)
		: undefined;
	if (!modifiers) return false;

	return modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Extract the name of a declaration node.
 *
 * For variable statements, returns the name of the first variable declarator.
 * Returns `undefined` for anonymous declarations (e.g., `export default function() {}`).
 */
export function getDeclarationName(node: ts.Node): string | undefined {
	if (ts.isVariableStatement(node)) {
		const decl = node.declarationList.declarations[0];
		if (decl && ts.isIdentifier(decl.name)) {
			return decl.name.text;
		}
		return undefined;
	}

	if (
		ts.isFunctionDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isClassDeclaration(node) ||
		ts.isEnumDeclaration(node)
	) {
		return node.name?.text;
	}

	return undefined;
}

/**
 * Determine the kind label for a declaration node.
 *
 * Maps AST node types to human-readable kind strings used in coverage reports.
 */
export function getDeclarationKind(node: ts.Node): string {
	if (ts.isFunctionDeclaration(node)) return "function";
	if (ts.isInterfaceDeclaration(node)) return "interface";
	if (ts.isTypeAliasDeclaration(node)) return "type";
	if (ts.isClassDeclaration(node)) return "class";
	if (ts.isEnumDeclaration(node)) return "enum";
	if (ts.isVariableStatement(node)) return "variable";
	return "unknown";
}

/**
 * Check whether a node has a leading JSDoc comment (starts with `/**`).
 *
 * Uses `ts.getLeadingCommentRanges` to inspect the raw source text,
 * filtering for block comments that begin with the JSDoc marker.
 */
function hasJSDocComment(node: ts.Node, sourceFile: ts.SourceFile): boolean {
	const sourceText = sourceFile.getFullText();
	const ranges = ts.getLeadingCommentRanges(sourceText, node.getFullStart());
	if (!ranges) return false;

	return ranges.some((range) => {
		if (range.kind !== ts.SyntaxKind.MultiLineCommentTrivia) return false;
		const text = sourceText.slice(range.pos, range.end);
		return text.startsWith("/**");
	});
}

/**
 * Check whether a member node (property, method) has a leading JSDoc comment.
 */
function memberHasJSDoc(member: ts.Node, sourceFile: ts.SourceFile): boolean {
	const sourceText = sourceFile.getFullText();
	const ranges = ts.getLeadingCommentRanges(sourceText, member.getFullStart());
	if (!ranges) return false;

	return ranges.some((range) => {
		if (range.kind !== ts.SyntaxKind.MultiLineCommentTrivia) return false;
		const text = sourceText.slice(range.pos, range.end);
		return text.startsWith("/**");
	});
}

/**
 * Classify a declaration's TSDoc coverage level.
 *
 * - `"documented"` -- has a JSDoc comment with a description. For interfaces
 *   and classes, all members must also have JSDoc comments.
 * - `"partial"` -- the declaration has a JSDoc comment but some members
 *   (in interfaces/classes) lack documentation.
 * - `"undocumented"` -- no JSDoc comment at all.
 */
export function classifyDeclaration(
	node: ts.Node,
	sourceFile: ts.SourceFile,
): CoverageLevel {
	const hasDoc = hasJSDocComment(node, sourceFile);

	if (!hasDoc) return "undocumented";

	// For interfaces and classes, check member documentation
	if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) {
		const members = node.members;
		if (members.length > 0) {
			const allMembersDocumented = members.every((member) =>
				memberHasJSDoc(member, sourceFile),
			);
			if (!allMembersDocumented) return "partial";
		}
	}

	return "documented";
}

/**
 * Analyze all exported declarations in a source file for TSDoc coverage.
 *
 * Walks top-level statements, filters to exported declarations, and
 * classifies each for documentation coverage.
 */
export function analyzeSourceFile(
	sourceFile: ts.SourceFile,
): DeclarationCoverage[] {
	const results: DeclarationCoverage[] = [];

	for (const statement of sourceFile.statements) {
		if (!isExportedDeclaration(statement)) continue;

		const name = getDeclarationName(statement);
		if (!name) continue;

		const kind = getDeclarationKind(statement);
		const level = classifyDeclaration(statement, sourceFile);
		const { line } = sourceFile.getLineAndCharacterOfPosition(
			statement.getStart(sourceFile),
		);

		results.push({
			name,
			kind,
			level,
			file: sourceFile.fileName,
			line: line + 1, // Convert 0-based to 1-based
		});
	}

	return results;
}

/**
 * Calculate aggregate coverage statistics from declaration results.
 *
 * Partial documentation counts as half coverage in the percentage calculation.
 * An empty array returns 100% (no declarations to check).
 */
export function calculateCoverage(
	declarations: readonly DeclarationCoverage[],
): {
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
		(d) => d.level === "documented",
	).length;
	const partial = declarations.filter((d) => d.level === "partial").length;
	const undocumented = declarations.filter(
		(d) => d.level === "undocumented",
	).length;

	// Partial counts as half
	const score = documented + partial * 0.5;
	const percentage = Math.round((score / total) * 100);

	return { documented, partial, undocumented, total, percentage };
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
	bold: "\x1b[1m",
};

// ---------------------------------------------------------------------------
// Runner helpers
// ---------------------------------------------------------------------------

/** Resolve whether JSON output mode is active. */
export function resolveJsonMode(options: CheckTsDocOptions = {}): boolean {
	return options.json ?? process.env["OUTFITTER_JSON"] === "1";
}

/** Build a visual bar chart for a percentage value. */
function bar(percentage: number, width = 20): string {
	const filled = Math.round((percentage / 100) * width);
	const empty = width - filled;
	const color =
		percentage >= 80
			? COLORS.green
			: percentage >= 50
				? COLORS.yellow
				: COLORS.red;
	return `${color}${"█".repeat(filled)}${COLORS.dim}${"░".repeat(empty)}${COLORS.reset}`;
}

/** Discover packages with src/index.ts entry points. */
function discoverPackages(
	cwd: string,
): Array<{ name: string; path: string; entryPoint: string }> {
	const glob = new Bun.Glob("packages/*/src/index.ts");
	const packages: Array<{ name: string; path: string; entryPoint: string }> =
		[];

	for (const match of glob.scanSync({ cwd, dot: false })) {
		// Extract package directory name
		const parts = match.split("/");
		const pkgDir = parts[1];
		if (!pkgDir) continue;

		const pkgRoot = resolve(cwd, "packages", pkgDir);
		let pkgName = pkgDir;

		// Try to read package.json for the real name
		try {
			const pkgJson = JSON.parse(
				require("node:fs").readFileSync(
					resolve(pkgRoot, "package.json"),
					"utf-8",
				),
			) as { name?: string };
			if (pkgJson.name) pkgName = pkgJson.name;
		} catch {
			// Fall back to directory name
		}

		packages.push({
			name: pkgName,
			path: pkgRoot,
			entryPoint: resolve(cwd, match),
		});
	}

	return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** Analyze a single package entry point, returning coverage data. */
function analyzePackage(pkg: {
	name: string;
	path: string;
	entryPoint: string;
}): PackageCoverage {
	// Try to find a tsconfig for this package, fall back to root
	let tsconfigPath = resolve(pkg.path, "tsconfig.json");
	try {
		require("node:fs").accessSync(tsconfigPath);
	} catch {
		tsconfigPath = resolve(process.cwd(), "tsconfig.json");
	}

	const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	const parsedConfig = ts.parseJsonConfigFileContent(
		configFile.config,
		ts.sys,
		pkg.path,
	);

	const program = ts.createProgram({
		rootNames: [pkg.entryPoint],
		options: parsedConfig.options,
		host: ts.createCompilerHost(parsedConfig.options),
	});

	const sourceFile = program.getSourceFile(pkg.entryPoint);
	if (!sourceFile) {
		return {
			name: pkg.name,
			path: pkg.path,
			declarations: [],
			documented: 0,
			partial: 0,
			undocumented: 0,
			total: 0,
			percentage: 100,
		};
	}

	const declarations = analyzeSourceFile(sourceFile);
	const stats = calculateCoverage(declarations);

	return {
		name: pkg.name,
		path: pkg.path,
		declarations,
		...stats,
	};
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run check-tsdoc across workspace packages.
 *
 * Discovers packages with `src/index.ts` entry points, analyzes TSDoc
 * coverage on exported declarations, and reports per-package statistics.
 */
export async function runCheckTsdoc(
	options: CheckTsDocOptions = {},
): Promise<void> {
	const cwd = process.cwd();
	const minCoverage = options.minCoverage ?? 0;

	// Discover or use provided paths
	let packages: Array<{ name: string; path: string; entryPoint: string }>;

	if (options.paths && options.paths.length > 0) {
		packages = options.paths.map((p) => {
			const absPath = resolve(cwd, p);
			const entryPoint = resolve(absPath, "src/index.ts");
			let name = p;

			try {
				const pkgJson = JSON.parse(
					require("node:fs").readFileSync(
						resolve(absPath, "package.json"),
						"utf-8",
					),
				) as { name?: string };
				if (pkgJson.name) name = pkgJson.name;
			} catch {
				// Fall back to path
			}

			return { name, path: absPath, entryPoint };
		});
	} else {
		packages = discoverPackages(cwd);
	}

	if (packages.length === 0) {
		process.stderr.write("No packages found with src/index.ts entry points.\n");
		process.exit(1);
	}

	// Analyze each package
	const packageResults: PackageCoverage[] = [];
	for (const pkg of packages) {
		packageResults.push(analyzePackage(pkg));
	}

	// Aggregate summary
	const allDeclarations = packageResults.flatMap((p) => p.declarations);
	const summary = calculateCoverage(allDeclarations);

	const ok = !options.strict || summary.percentage >= minCoverage;

	const result: TsDocCheckResult = {
		ok,
		packages: packageResults,
		summary,
	};

	// Output
	if (resolveJsonMode(options)) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(
			`\n${COLORS.bold}TSDoc Coverage Report${COLORS.reset}\n\n`,
		);

		for (const pkg of packageResults) {
			const color =
				pkg.percentage >= 80
					? COLORS.green
					: pkg.percentage >= 50
						? COLORS.yellow
						: COLORS.red;

			process.stdout.write(
				`  ${color}${pkg.percentage.toString().padStart(3)}%${COLORS.reset} ${bar(pkg.percentage)} ${pkg.name}\n`,
			);

			if (pkg.total > 0) {
				const parts: string[] = [];
				if (pkg.documented > 0)
					parts.push(
						`${COLORS.green}${pkg.documented} documented${COLORS.reset}`,
					);
				if (pkg.partial > 0)
					parts.push(`${COLORS.yellow}${pkg.partial} partial${COLORS.reset}`);
				if (pkg.undocumented > 0)
					parts.push(
						`${COLORS.red}${pkg.undocumented} undocumented${COLORS.reset}`,
					);
				process.stdout.write(
					`       ${COLORS.dim}${pkg.total} declarations:${COLORS.reset} ${parts.join(", ")}\n`,
				);
			} else {
				process.stdout.write(
					`       ${COLORS.dim}no exported declarations${COLORS.reset}\n`,
				);
			}
		}

		process.stdout.write(
			`\n  ${COLORS.bold}Summary:${COLORS.reset} ${summary.percentage}% coverage (${summary.documented} documented, ${summary.partial} partial, ${summary.undocumented} undocumented of ${summary.total} total)\n`,
		);

		if (options.strict && summary.percentage < minCoverage) {
			process.stderr.write(
				`\n  ${COLORS.red}Coverage ${summary.percentage}% is below minimum threshold of ${minCoverage}%${COLORS.reset}\n`,
			);
		}

		process.stdout.write("\n");
	}

	process.exit(ok ? 0 : 1);
}

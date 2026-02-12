#!/usr/bin/env bun
/**
 * Generates config-file exports in package.json from the `files` array.
 *
 * Any file in `files` with a config extension (.json, .jsonc, .yml, .yaml, .toml)
 * gets two exports: the full filename and an extensionless short alias.
 *
 * Short alias rules:
 *   biome.json               → ./biome
 *   tsconfig.preset.json     → ./tsconfig
 *   tsconfig.preset.bun.json → ./tsconfig-bun
 *   lefthook.yml             → ./lefthook
 *   .markdownlint-cli2.jsonc → ./.markdownlint-cli2
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_EXTENSIONS = /\.(json|jsonc|yml|yaml|toml)$/;
const CHECK_FLAG = "--check";

type PackageJsonLike = {
	files?: string[];
	exports?: Record<string, unknown>;
};

export function shortAlias(filename: string): string {
	// Strip extension
	let base = filename.replace(CONFIG_EXTENSIONS, "");

	// Handle .preset.variant → name-variant
	const match = base.match(/^(.+)\.preset(?:\.(.+))?$/);
	if (match) {
		const presetName = match[1];
		if (presetName) {
			base = match[2] ? `${presetName}-${match[2]}` : presetName;
		}
	}

	return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configFilesFrom(files: string[] | undefined): string[] {
	return (files ?? []).filter(
		(file) => CONFIG_EXTENSIONS.test(file) && file !== "package.json",
	);
}

export function sortExports(
	exportsMap: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(exportsMap).sort(([left], [right]) =>
			left.localeCompare(right),
		),
	);
}

export function buildSyncedExports(
	pkg: PackageJsonLike,
): Record<string, unknown> {
	const configFiles = configFilesFrom(pkg.files);
	const configPaths = new Set(
		configFiles.flatMap((file) => [`./${file}`, `./${shortAlias(file)}`]),
	);

	const reconciledExports: Record<string, unknown> = {};
	const currentExports = isRecord(pkg.exports) ? pkg.exports : {};

	for (const [key, value] of Object.entries(currentExports)) {
		if (!configPaths.has(key)) {
			reconciledExports[key] = value;
		}
	}

	for (const file of configFiles) {
		const alias = shortAlias(file);
		reconciledExports[`./${alias}`] = `./${file}`;
		if (alias !== file) {
			reconciledExports[`./${file}`] = `./${file}`;
		}
	}

	return sortExports(reconciledExports);
}

if (import.meta.main) {
	const isCheckMode = Bun.argv.includes(CHECK_FLAG);
	const pkgPath = join(import.meta.dirname, "../package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJsonLike;
	const currentExports = isRecord(pkg.exports) ? pkg.exports : {};
	const nextExports = buildSyncedExports(pkg);
	const configFiles = configFilesFrom(pkg.files);

	if (JSON.stringify(currentExports) === JSON.stringify(nextExports)) {
		console.log(
			`[sync-exports] exports are up to date (${configFiles.length} config files)`,
		);
		process.exit(0);
	}

	if (isCheckMode) {
		console.error(
			"[sync-exports] exports are out of sync. Run: bun run --filter @outfitter/tooling sync:exports",
		);
		process.exit(1);
	}

	pkg.exports = nextExports;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);

	console.log(
		`[sync-exports] wrote ${Object.keys(nextExports).length} exports (${configFiles.length} config files)`,
	);
}

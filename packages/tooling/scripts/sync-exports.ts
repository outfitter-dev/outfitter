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

if (import.meta.main) {
	const pkgPath = join(import.meta.dirname, "../package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

	const configFiles = (pkg.files as string[]).filter(
		(f: string) => CONFIG_EXTENSIONS.test(f) && f !== "package.json",
	);

	// Separate JS/code exports from config exports
	const exports: Record<string, unknown> = {};
	const configPaths = new Set(
		configFiles.flatMap((f: string) => [`./${f}`, `./${shortAlias(f)}`]),
	);

	for (const [key, value] of Object.entries(
		pkg.exports as Record<string, unknown>,
	)) {
		if (!configPaths.has(key)) {
			exports[key] = value;
		}
	}

	// Generate config exports (full path + short alias)
	for (const file of configFiles) {
		const alias = shortAlias(file);
		exports[`./${alias}`] = `./${file}`;
		if (alias !== file) {
			exports[`./${file}`] = `./${file}`;
		}
	}

	pkg.exports = exports;
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);

	console.log(
		`[sync-exports] ${configFiles.length} config files → ${configPaths.size} exports`,
	);
}

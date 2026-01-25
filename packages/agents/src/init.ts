/**
 * Initialize agent documentation in a project.
 */

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { mergeSettings, type SettingsJson } from "./merge.js";

export interface InitOptions {
	/**
	 * Target directory (defaults to cwd).
	 */
	target?: string;

	/**
	 * Merge with existing files instead of skipping.
	 */
	merge?: boolean;

	/**
	 * Overwrite existing files.
	 */
	force?: boolean;

	/**
	 * Suppress output.
	 */
	quiet?: boolean;
}

const TEMPLATES_DIR = resolve(import.meta.dirname, "../scaffolding/templates");

function log(message: string, quiet: boolean): void {
	// biome-ignore lint/suspicious/noConsole: CLI output is intentional
	if (!quiet) console.log(message);
}

function success(message: string, quiet: boolean): void {
	// biome-ignore lint/suspicious/noConsole: CLI output is intentional
	if (!quiet) console.log(`✓ ${message}`);
}

function skip(message: string, quiet: boolean): void {
	// biome-ignore lint/suspicious/noConsole: CLI output is intentional
	if (!quiet) console.log(`- ${message}`);
}

async function copyTemplate(src: string, dest: string, options: InitOptions): Promise<void> {
	const { merge = false, force = false, quiet = false } = options;

	const destFile = Bun.file(dest);
	const exists = await destFile.exists();

	if (exists && !force && !merge) {
		skip(`${dest} (exists)`, quiet);
		return;
	}

	const srcFile = Bun.file(src);
	const content = await srcFile.text();

	if (exists && merge && dest.endsWith("settings.json")) {
		// Special merge logic for settings.json
		const existing = (await destFile.json()) as SettingsJson;
		const defaults = JSON.parse(content) as SettingsJson;
		const merged = mergeSettings(existing, defaults);
		await Bun.write(dest, `${JSON.stringify(merged, null, 2)}\n`);
		success(`${dest} (merged)`, quiet);
	} else {
		// Ensure directory exists
		await Bun.write(dest, content);
		success(dest, quiet);
	}
}

/**
 * Initialize agent documentation in target directory.
 */
export async function initAgentDocs(options: InitOptions = {}): Promise<void> {
	const { target = process.cwd(), quiet = false } = options;

	log("\nInitializing agent documentation...\n", quiet);

	// Create .claude directory
	const claudeDir = resolve(target, ".claude");
	const hooksDir = resolve(claudeDir, "hooks");

	await mkdir(claudeDir, { recursive: true });
	await mkdir(hooksDir, { recursive: true });

	// Copy templates
	await copyTemplate(resolve(TEMPLATES_DIR, "AGENTS.md"), resolve(target, "AGENTS.md"), options);

	await copyTemplate(resolve(TEMPLATES_DIR, "CLAUDE.md"), resolve(target, "CLAUDE.md"), options);

	await copyTemplate(
		resolve(TEMPLATES_DIR, ".claude/CLAUDE.md"),
		resolve(claudeDir, "CLAUDE.md"),
		options,
	);

	await copyTemplate(
		resolve(TEMPLATES_DIR, ".claude/settings.json"),
		resolve(claudeDir, "settings.json"),
		options,
	);

	await copyTemplate(
		resolve(TEMPLATES_DIR, ".claude/hooks/bootstrap.sh"),
		resolve(hooksDir, "bootstrap.sh"),
		options,
	);

	// Make bootstrap executable
	const bootstrapPath = resolve(hooksDir, "bootstrap.sh");
	if (await Bun.file(bootstrapPath).exists()) {
		Bun.spawnSync(["chmod", "+x", bootstrapPath]);
	}

	log("\n✓ Agent documentation initialized!\n", quiet);
}

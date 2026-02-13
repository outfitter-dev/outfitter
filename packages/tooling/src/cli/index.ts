#!/usr/bin/env bun
/**
 * @outfitter/tooling CLI
 *
 * Commands for managing dev tooling configuration in Outfitter projects.
 *
 * @packageDocumentation
 */

import { Command } from "commander";
import { VERSION } from "../version.js";
import { runCheck } from "./check.js";
import { runCheckCleanTree } from "./check-clean-tree.js";
import { runCheckExports } from "./check-exports.js";
import { runFix } from "./fix.js";
import { runInit } from "./init.js";
import { runPrePush } from "./pre-push.js";
import { runUpgradeBun } from "./upgrade-bun.js";

const program = new Command();

program
	.name("tooling")
	.description("Dev tooling configuration management for Outfitter projects")
	.version(VERSION);

program
	.command("init")
	.description("Initialize tooling config in the current project")
	.action(async () => {
		await runInit();
	});

program
	.command("check")
	.description("Run linting checks (wraps ultracite)")
	.argument("[paths...]", "Paths to check")
	.action(async (paths: string[]) => {
		await runCheck(paths);
	});

program
	.command("fix")
	.description("Fix linting issues (wraps ultracite)")
	.argument("[paths...]", "Paths to fix")
	.action(async (paths: string[]) => {
		await runFix(paths);
	});

program
	.command("upgrade-bun")
	.description("Upgrade Bun version across the project")
	.argument("[version]", "Target version (defaults to latest)")
	.option("--no-install", "Skip installing Bun and updating lockfile")
	.action(
		async (version: string | undefined, options: { install: boolean }) => {
			await runUpgradeBun(version, options);
		},
	);

program
	.command("pre-push")
	.description("TDD-aware pre-push strict verification hook")
	.option("-f, --force", "Skip strict verification entirely")
	.action(async (options: { force?: boolean }) => {
		await runPrePush(options);
	});

program
	.command("check-exports")
	.description("Validate package.json exports match source entry points")
	.option("--json", "Output results as JSON")
	.action(async (options: { json?: boolean }) => {
		await runCheckExports(options);
	});

program
	.command("check-clean-tree")
	.description("Assert working tree is clean (no modified or untracked files)")
	.option("--paths <paths...>", "Limit check to specific paths")
	.action(async (options: { paths?: string[] }) => {
		await runCheckCleanTree(options);
	});

program
	.command("check-readme-imports")
	.description("Validate README import examples match package exports")
	.option("--json", "Output results as JSON")
	.action(async (options: { json?: boolean }) => {
		const { runCheckReadmeImports } = await import("./check-readme-imports.js");
		await runCheckReadmeImports(options);
	});

program.parse();

#!/usr/bin/env bun

/**
 * @outfitter/tooling CLI
 *
 * Commands for managing dev tooling configuration in Outfitter projects.
 *
 * @packageDocumentation
 */

import { exitWithError } from "@outfitter/cli";
import { createCLI } from "@outfitter/cli/command";
import { Command } from "commander";
import { VERSION } from "../version.js";
import { runCheck } from "./check.js";
import { runCheckBoundaryInvocations } from "./check-boundary-invocations.js";
import { runCheckBunupRegistry } from "./check-bunup-registry.js";
import { runCheckChangeset } from "./check-changeset.js";
import { runCheckCleanTree } from "./check-clean-tree.js";
import { runCheckExports } from "./check-exports.js";
import { runFix } from "./fix.js";
import { runInit } from "./init.js";
import { runPrePush } from "./pre-push.js";
import { runUpgradeBun } from "./upgrade-bun.js";

const cli = createCLI({
	name: "tooling",
	version: VERSION,
	description: "Dev tooling configuration management for Outfitter projects",
	onError: (error) => {
		const err =
			error instanceof Error
				? error
				: new Error("An unexpected error occurred");
		exitWithError(err);
	},
});

function register(command: Command): void {
	cli.register(command);
}

register(
	new Command("init")
		.description("Initialize tooling config in the current project")
		.action(async () => {
			await runInit();
		}),
);

register(
	new Command("check")
		.description("Run linting checks (wraps ultracite)")
		.argument("[paths...]", "Paths to check")
		.action(async (paths: string[]) => {
			await runCheck(paths);
		}),
);

register(
	new Command("fix")
		.description("Fix linting issues (wraps ultracite)")
		.argument("[paths...]", "Paths to fix")
		.action(async (paths: string[]) => {
			await runFix(paths);
		}),
);

register(
	new Command("upgrade-bun")
		.description("Upgrade Bun version across the project")
		.argument("[version]", "Target version (defaults to latest)")
		.option("--no-install", "Skip installing Bun and updating lockfile")
		.action(
			async (version: string | undefined, options: { install: boolean }) => {
				await runUpgradeBun(version, options);
			},
		),
);

register(
	new Command("pre-push")
		.description("TDD-aware pre-push strict verification hook")
		.option("-f, --force", "Skip strict verification entirely")
		.action(async (options: { force?: boolean }) => {
			await runPrePush(options);
		}),
);

register(
	new Command("check-bunup-registry")
		.description(
			"Validate packages with bunup --filter are registered in bunup.config.ts",
		)
		.action(async () => {
			await runCheckBunupRegistry();
		}),
);

register(
	new Command("check-changeset")
		.description("Validate PRs touching package source include a changeset")
		.option("-s, --skip", "Skip changeset check")
		.action(async (options: { skip?: boolean }) => {
			await runCheckChangeset(options);
		}),
);

register(
	new Command("check-exports")
		.description("Validate package.json exports match source entry points")
		.option("--json", "Output results as JSON")
		.action(async (options: { json?: boolean }) => {
			await runCheckExports(options);
		}),
);

register(
	new Command("check-clean-tree")
		.description(
			"Assert working tree is clean (no modified or untracked files)",
		)
		.option("--paths <paths...>", "Limit check to specific paths")
		.action(async (options: { paths?: string[] }) => {
			await runCheckCleanTree(options);
		}),
);

register(
	new Command("check-readme-imports")
		.description("Validate README import examples match package exports")
		.option("--json", "Output results as JSON")
		.action(async (options: { json?: boolean }) => {
			const { runCheckReadmeImports } = await import(
				"./check-readme-imports.js"
			);
			await runCheckReadmeImports(options);
		}),
);

register(
	new Command("check-boundary-invocations")
		.description(
			"Validate root/app scripts do not execute packages/*/src entrypoints directly",
		)
		.action(async () => {
			await runCheckBoundaryInvocations();
		}),
);

await cli.parse();

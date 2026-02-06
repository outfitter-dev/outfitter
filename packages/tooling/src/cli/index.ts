#!/usr/bin/env bun
/**
 * @outfitter/tooling CLI
 *
 * Commands for managing dev tooling configuration in Outfitter projects.
 *
 * @packageDocumentation
 */

import { Command } from "commander";
import { runCheck } from "./check.js";
import { runFix } from "./fix.js";
import { runInit } from "./init.js";
import { runPrePush } from "./pre-push.js";
import { runUpgradeBun } from "./upgrade-bun.js";

const program = new Command();

program
	.name("tooling")
	.description("Dev tooling configuration management for Outfitter projects")
	.version("0.1.0-rc.1");

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
	.action(async (version: string | undefined, options: { install: boolean }) => {
		await runUpgradeBun(version, options);
	});

program
	.command("pre-push")
	.description("TDD-aware pre-push test hook")
	.option("-f, --force", "Skip tests entirely")
	.action(async (options: { force?: boolean }) => {
		await runPrePush(options);
	});

program.parse();

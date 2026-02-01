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

program.parse();

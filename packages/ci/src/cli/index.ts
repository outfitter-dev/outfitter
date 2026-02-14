#!/usr/bin/env bun

import { Command } from "commander";
import { runInit } from "./init.js";

const program = new Command();

program
  .name("outfitter-ci")
  .description("Initialize Outfitter CI workflows")
  .version("0.1.0");

program
  .command("init")
  .description("Copy CI workflow templates and setup package scripts")
  .option("--default-branch <branch>", "Default release branch", "main")
  .option(
    "--bun-version <version>",
    "Bun version for setup-bun action",
    "1.3.7"
  )
  .option(
    "--node-version <version>",
    "Node version for setup-node action",
    "24"
  )
  .action(async (options) => {
    await runInit({
      defaultBranch: options.defaultBranch,
      bunVersion: options.bunVersion,
      nodeVersion: options.nodeVersion,
    });
  });

program.parse();

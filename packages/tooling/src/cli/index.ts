#!/usr/bin/env bun
/**
 * @outfitter/tooling CLI
 *
 * Commands for managing dev tooling configuration in Outfitter projects.
 *
 * @packageDocumentation
 */

import { Command } from "commander";

const program = new Command();

program
  .name("tooling")
  .description("Dev tooling configuration management for Outfitter projects")
  .version("0.1.0-rc.1");

// Commands will be added in subsequent tasks:
// - init: Initialize tooling config in a project
// - check: Run linting checks (wraps ultracite)
// - fix: Fix linting issues (wraps ultracite)

program.parse();

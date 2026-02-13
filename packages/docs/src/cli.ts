#!/usr/bin/env bun

import { Command } from "commander";
import { createDocsCommand } from "./command/create-docs-command.js";
import { VERSION } from "./version.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("outfitter-docs")
    .description("Outfitter docs command line interface")
    .version(VERSION);

  const docsCommand = createDocsCommand();
  docsCommand.name("docs");

  program.addCommand(docsCommand);

  await program.parseAsync(process.argv);
}

main();

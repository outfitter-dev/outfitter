#!/usr/bin/env bun

import { syncPackageDocs } from "./index.js";

interface CliOptions {
  cwd?: string;
  packagesDir?: string;
  outputDir?: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const nextValue = argv[i + 1];

    if (arg === "--cwd") {
      if (typeof nextValue === "string") {
        options.cwd = nextValue;
        i += 1;
      }
      continue;
    }

    if (arg === "--packages-dir") {
      if (typeof nextValue === "string") {
        options.packagesDir = nextValue;
        i += 1;
      }
      continue;
    }

    if (arg === "--output-dir" && typeof nextValue === "string") {
      options.outputDir = nextValue;
      i += 1;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const result = await syncPackageDocs({
    ...(options.cwd ? { workspaceRoot: options.cwd } : {}),
    ...(options.packagesDir ? { packagesDir: options.packagesDir } : {}),
    ...(options.outputDir ? { outputDir: options.outputDir } : {}),
  });

  if (result.isErr()) {
    process.stderr.write(`docs sync failed: ${result.error.message}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `docs sync complete: ${result.value.packageNames.length} package(s), ` +
      `${result.value.writtenFiles.length} file(s) written, ` +
      `${result.value.removedFiles.length} stale file(s) removed\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`docs sync failed: ${message}\n`);
  process.exit(1);
});

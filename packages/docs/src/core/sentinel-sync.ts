#!/usr/bin/env bun
/**
 * Sentinel sync script.
 *
 * Reads "docs/README.md", generates the package list table from workspace
 * packages, and replaces the sentinel-wrapped PACKAGE_LIST section. Writes
 * the updated file back to disk.
 *
 * Usage: bun packages/docs/src/core/sentinel-sync.ts [--cwd <path>]
 *
 * @packageDocumentation
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  generatePackageListSection,
  replaceSentinelSection,
} from "./sentinel-generator.js";

async function main(): Promise<void> {
  const cwdIndex = process.argv.indexOf("--cwd");
  const cwdArg = cwdIndex >= 0 ? process.argv[cwdIndex + 1] : undefined;
  const workspaceRoot = cwdArg ? resolve(cwdArg) : process.cwd();

  const readmePath = join(workspaceRoot, "docs", "README.md");
  const sectionId = "PACKAGE_LIST";
  const beginTag = `<!-- BEGIN:GENERATED:${sectionId} -->`;
  const endTag = `<!-- END:GENERATED:${sectionId} -->`;

  const [readmeContent, packageListContent] = await Promise.all([
    readFile(readmePath, "utf8"),
    generatePackageListSection(workspaceRoot),
  ]);

  if (!(readmeContent.includes(beginTag) && readmeContent.includes(endTag))) {
    process.stderr.write("docs/README.md is missing PACKAGE_LIST sentinel markers.\n");
    process.exitCode = 1;
    return;
  }

  const updated = replaceSentinelSection(
    readmeContent,
    sectionId,
    packageListContent
  );

  if (updated === readmeContent) {
    process.stdout.write("docs/README.md is up to date.\n");
    return;
  }

  await writeFile(readmePath, updated, "utf8");
  process.stdout.write("docs/README.md updated with generated package list.\n");
}

await main();

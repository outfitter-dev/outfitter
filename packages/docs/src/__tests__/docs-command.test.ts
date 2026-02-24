import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Command } from "commander";

import { createDocsCommand } from "../command/create-docs-command.js";
import {
  DOCS_COMMON_OPTION_FLAGS,
  DOCS_EXPORT_OPTION_FLAGS,
} from "../command/docs-option-bundle.js";
import { executeCheckCommand } from "../commands/check.js";
import { executeExportCommand } from "../commands/export.js";
import { executeSyncCommand } from "../commands/sync.js";

async function createWorkspaceFixture(): Promise<string> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "outfitter-docs-test-"));
  const pkgRoot = join(workspaceRoot, "packages", "alpha");

  await mkdir(join(pkgRoot, "docs"), { recursive: true });
  await mkdir(join(workspaceRoot, "docs"), { recursive: true });

  await writeFile(join(workspaceRoot, "docs", "PATTERNS.md"), "# Patterns\n");
  await writeFile(
    join(pkgRoot, "package.json"),
    JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
  );
  await writeFile(
    join(pkgRoot, "README.md"),
    "# Alpha\n\nSee [patterns](../../docs/PATTERNS.md).\n"
  );

  return workspaceRoot;
}

describe("docs command execution", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    for (const workspaceRoot of workspaceRoots) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
    workspaceRoots.clear();
  });

  it("executeSyncCommand returns success and writes outputs", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    workspaceRoots.add(workspaceRoot);

    const out: string[] = [];
    const err: string[] = [];

    const code = await executeSyncCommand(
      { cwd: workspaceRoot },
      {
        out: (line) => out.push(line),
        err: (line) => err.push(line),
      }
    );

    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out[0]).toContain("Synced package docs for 1 package(s)");

    const generatedReadme = await readFile(
      join(workspaceRoot, "docs", "packages", "alpha", "README.md"),
      "utf8"
    );
    expect(generatedReadme).toContain("[patterns](../../PATTERNS.md)");
  });

  it("executeCheckCommand reports drift when generated docs are stale", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    workspaceRoots.add(workspaceRoot);

    const syncCode = await executeSyncCommand(
      { cwd: workspaceRoot },
      { out: () => undefined, err: () => undefined }
    );
    expect(syncCode).toBe(0);

    await writeFile(
      join(workspaceRoot, "docs", "packages", "alpha", "README.md"),
      "# stale\n"
    );

    const out: string[] = [];
    const err: string[] = [];

    const checkCode = await executeCheckCommand(
      { cwd: workspaceRoot },
      {
        out: (line) => out.push(line),
        err: (line) => err.push(line),
      }
    );

    expect(checkCode).toBe(1);
    expect(out).toEqual([]);
    expect(err[0]).toBe("Package docs are stale:");
    expect(err.some((line) => line.includes("[changed]"))).toBe(true);
  });

  it("executeExportCommand exports llms.txt for the llms target", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    workspaceRoots.add(workspaceRoot);

    const out: string[] = [];
    const err: string[] = [];

    const code = await executeExportCommand(
      { cwd: workspaceRoot, target: "llms" },
      {
        out: (line) => out.push(line),
        err: (line) => err.push(line),
      }
    );

    expect(code).toBe(0);
    expect(err).toEqual([]);
    expect(out[0]).toContain("Exported llms docs");

    const llmsIndex = await readFile(
      join(workspaceRoot, "docs", "llms.txt"),
      "utf8"
    );
    expect(llmsIndex).toContain("docs/packages/alpha/README.md");
  });
});

describe("createDocsCommand", () => {
  const originalExitCode = process.exitCode ?? 0;
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    process.exitCode = originalExitCode;
    for (const workspaceRoot of workspaceRoots) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
    workspaceRoots.clear();
  });

  it("creates a host-mountable docs command with sync, check, and export subcommands", () => {
    const command = createDocsCommand();

    expect(command.name()).toBe("docs");

    const subcommandNames = command.commands.map((subcommand: Command) =>
      subcommand.name()
    );

    expect(subcommandNames).toEqual(["sync", "check", "export", "sync-readme"]);
  });

  it("uses shared docs option bundles across subcommands", () => {
    const command = createDocsCommand();
    const sync = command.commands.find(
      (subcommand) => subcommand.name() === "sync"
    );
    const check = command.commands.find(
      (subcommand) => subcommand.name() === "check"
    );
    const exportCommand = command.commands.find(
      (subcommand) => subcommand.name() === "export"
    );

    const commonFlags = [...DOCS_COMMON_OPTION_FLAGS];
    const exportFlags = [
      ...DOCS_COMMON_OPTION_FLAGS,
      ...DOCS_EXPORT_OPTION_FLAGS,
    ];

    expect(sync?.options.map((option) => option.flags)).toEqual(commonFlags);
    expect(check?.options.map((option) => option.flags)).toEqual(commonFlags);
    expect(exportCommand?.options.map((option) => option.flags)).toEqual(
      exportFlags
    );
  });

  it("sync-readme fails when PACKAGE_LIST sentinel markers are missing", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "outfitter-docs-sync-readme-test-")
    );
    workspaceRoots.add(workspaceRoot);

    await mkdir(join(workspaceRoot, "docs"), { recursive: true });
    await writeFile(
      join(workspaceRoot, "docs", "README.md"),
      "# Docs\n\nNo sentinels here.\n",
      "utf8"
    );

    const out: string[] = [];
    const err: string[] = [];
    const command = createDocsCommand({
      io: {
        out: (line) => out.push(line),
        err: (line) => err.push(line),
      },
    });

    await command.parseAsync(
      ["node", "docs", "sync-readme", "--cwd", workspaceRoot],
      { from: "node" }
    );

    expect(out).toEqual([]);
    expect(err).toEqual([
      "docs/README.md is missing PACKAGE_LIST sentinel markers.",
    ]);
    expect(process.exitCode).toBe(1);
  });

  it("sync-readme updates PACKAGE_LIST sentinel section when markers exist", async () => {
    const workspaceRoot = await createWorkspaceFixture();
    workspaceRoots.add(workspaceRoot);

    await writeFile(
      join(workspaceRoot, "docs", "README.md"),
      [
        "# Docs",
        "",
        "<!-- BEGIN:GENERATED:PACKAGE_LIST -->",
        "stale generated content",
        "<!-- END:GENERATED:PACKAGE_LIST -->",
        "",
      ].join("\n"),
      "utf8"
    );

    const out: string[] = [];
    const err: string[] = [];
    const command = createDocsCommand({
      io: {
        out: (line) => out.push(line),
        err: (line) => err.push(line),
      },
    });

    await command.parseAsync(
      ["node", "docs", "sync-readme", "--cwd", workspaceRoot],
      { from: "node" }
    );

    const updatedReadme = await readFile(
      join(workspaceRoot, "docs", "README.md"),
      "utf8"
    );

    expect(err).toEqual([]);
    expect(out).toEqual([
      "docs/README.md updated with generated package list.",
    ]);
    expect(updatedReadme).toContain("| Package | Description |");
    expect(updatedReadme).toContain(
      "| [`@acme/alpha`](../packages/alpha/) | |"
    );
    expect(updatedReadme).not.toContain("stale generated content");
    expect(process.exitCode).toBe(originalExitCode);
  });
});

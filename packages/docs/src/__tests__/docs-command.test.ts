import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { createDocsCommand } from "../command/create-docs-command.js";
import { executeCheckCommand } from "../commands/check.js";
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
});

describe("createDocsCommand", () => {
  it("creates a host-mountable docs command with sync and check subcommands", () => {
    const command = createDocsCommand();

    expect(command.name()).toBe("docs");

    const subcommandNames = command.commands.map((subcommand: Command) =>
      subcommand.name()
    );

    expect(subcommandNames).toEqual(["sync", "check"]);
  });
});

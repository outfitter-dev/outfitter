import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  DOCS_COMMON_OPTION_FLAGS,
  DOCS_EXPORT_OPTION_FLAGS,
} from "@outfitter/docs";
import {
  createRepoCommand,
  type RepoToolingInvocation,
} from "../commands/repo.js";

describe("createRepoCommand", () => {
  const originalExitCode = process.exitCode;
  let capturedDocsCheckOptions: Record<string, unknown> | undefined;
  let capturedDocsSyncOptions: Record<string, unknown> | undefined;
  let capturedDocsExportOptions: Record<string, unknown> | undefined;
  const toolingCalls: RepoToolingInvocation[] = [];

  beforeEach(() => {
    process.exitCode = 0;
    capturedDocsCheckOptions = undefined;
    capturedDocsSyncOptions = undefined;
    capturedDocsExportOptions = undefined;
    toolingCalls.length = 0;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  function createTestCommand() {
    return createRepoCommand({
      runDocsCheck: async (options) => {
        capturedDocsCheckOptions = options as Record<string, unknown>;
        return 0;
      },
      runDocsSync: async (options) => {
        capturedDocsSyncOptions = options as Record<string, unknown>;
        return 0;
      },
      runDocsExport: async (options) => {
        capturedDocsExportOptions = options as Record<string, unknown>;
        return 0;
      },
      runToolingCommand: async (input) => {
        toolingCalls.push(input);
        return 0;
      },
    });
  }

  test("routes `repo check docs` to docs check runner", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      [
        "node",
        "repo",
        "check",
        "docs",
        "--cwd",
        "fixtures/workspace",
        "--packages-dir",
        "custom-packages",
        "--output-dir",
        "custom-docs",
        "--mdx-mode",
        "lossy",
      ],
      { from: "node" }
    );

    expect(capturedDocsCheckOptions).toBeDefined();
    expect(capturedDocsCheckOptions).toEqual({
      cwd: resolve(process.cwd(), "fixtures/workspace"),
      packagesDir: "custom-packages",
      outputDir: "custom-docs",
      mdxMode: "lossy",
    });
  });

  test("routes `repo sync docs` and `repo export docs`", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      [
        "node",
        "repo",
        "sync",
        "docs",
        "--cwd",
        "fixtures/workspace",
        "--packages-dir",
        "sync-packages",
        "--output-dir",
        "sync-docs",
        "--mdx-mode",
        "strict",
      ],
      {
        from: "node",
      }
    );
    await command.parseAsync(
      [
        "node",
        "repo",
        "export",
        "docs",
        "--cwd",
        "fixtures/workspace",
        "--packages-dir",
        "export-packages",
        "--output-dir",
        "export-docs",
        "--mdx-mode",
        "lossy",
        "--llms-file",
        "custom-llms.txt",
        "--llms-full-file",
        "custom-llms-full.txt",
        "--target",
        "llms",
      ],
      { from: "node" }
    );

    expect(capturedDocsSyncOptions).toEqual({
      cwd: resolve(process.cwd(), "fixtures/workspace"),
      packagesDir: "sync-packages",
      outputDir: "sync-docs",
      mdxMode: "strict",
    });
    expect(capturedDocsExportOptions).toEqual({
      cwd: resolve(process.cwd(), "fixtures/workspace"),
      packagesDir: "export-packages",
      outputDir: "export-docs",
      mdxMode: "lossy",
      llmsFile: "custom-llms.txt",
      llmsFullFile: "custom-llms-full.txt",
      target: "llms",
    });
  });

  test("routes `repo check exports` to tooling check-exports", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      ["node", "repo", "check", "exports", "--json", "--cwd", "repo-root"],
      { from: "node" }
    );

    expect(toolingCalls).toHaveLength(1);
    expect(toolingCalls[0]).toEqual({
      command: "check-exports",
      args: ["--json"],
      cwd: resolve(process.cwd(), "repo-root"),
    });
  });

  test("routes `repo check readme` to tooling check-readme-imports", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      ["node", "repo", "check", "readme", "--json", "--cwd", "repo-root"],
      { from: "node" }
    );

    expect(toolingCalls).toHaveLength(1);
    expect(toolingCalls[0]).toEqual({
      command: "check-readme-imports",
      args: ["--json"],
      cwd: resolve(process.cwd(), "repo-root"),
    });
  });

  test("routes `repo check registry` to tooling check-bunup-registry", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      ["node", "repo", "check", "registry", "--cwd", "repo-root"],
      { from: "node" }
    );

    expect(toolingCalls).toHaveLength(1);
    expect(toolingCalls[0]).toEqual({
      command: "check-bunup-registry",
      args: [],
      cwd: resolve(process.cwd(), "repo-root"),
    });
  });

  test("routes `repo check tree` with --paths to tooling", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      ["node", "repo", "check", "tree", "--paths", "docs", "packages"],
      { from: "node" }
    );

    expect(toolingCalls).toHaveLength(1);
    expect(toolingCalls[0]).toEqual({
      command: "check-clean-tree",
      args: ["--paths", "docs", "packages"],
      cwd: process.cwd(),
    });
  });

  test("routes `repo check changeset` with --skip to tooling", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      ["node", "repo", "check", "changeset", "--skip", "--cwd", "repo-root"],
      { from: "node" }
    );

    expect(toolingCalls).toHaveLength(1);
    expect(toolingCalls[0]).toEqual({
      command: "check-changeset",
      args: ["--skip"],
      cwd: resolve(process.cwd(), "repo-root"),
    });
  });

  test("routes `repo check boundary-invocations` to tooling", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      ["node", "repo", "check", "boundary-invocations", "--cwd", "repo-root"],
      { from: "node" }
    );

    expect(toolingCalls).toHaveLength(1);
    expect(toolingCalls[0]).toEqual({
      command: "check-boundary-invocations",
      args: [],
      cwd: resolve(process.cwd(), "repo-root"),
    });
  });

  test("does not register removed top-level legacy alias commands", () => {
    const command = createTestCommand();
    const topLevelNames = command.commands.map((subcommand) =>
      subcommand.name()
    );

    expect(topLevelNames).not.toContain("docs-check");
    expect(topLevelNames).not.toContain("docs-sync");
    expect(topLevelNames).not.toContain("docs-export");
    expect(topLevelNames).not.toContain("check-exports");
    expect(topLevelNames).not.toContain("check-readme-imports");
    expect(topLevelNames).not.toContain("check-bunup-registry");
    expect(topLevelNames).not.toContain("check-changeset");
    expect(topLevelNames).not.toContain("check-clean-tree");
    expect(topLevelNames).not.toContain("check-boundary-invocations");
  });

  test("does not register removed subject aliases", () => {
    const command = createTestCommand();
    const checkCommand = command.commands.find(
      (subcommand) => subcommand.name() === "check"
    );
    const checkSubcommands = checkCommand?.commands ?? [];

    const readmeCommand = checkSubcommands.find(
      (subcommand) => subcommand.name() === "readme"
    );
    const registryCommand = checkSubcommands.find(
      (subcommand) => subcommand.name() === "registry"
    );
    const treeCommand = checkSubcommands.find(
      (subcommand) => subcommand.name() === "tree"
    );

    expect(readmeCommand?.aliases()).toEqual([]);
    expect(registryCommand?.aliases()).toEqual([]);
    expect(treeCommand?.aliases()).toEqual([]);
  });

  test("reuses shared docs option bundle definitions", () => {
    const command = createTestCommand();
    const checkCommand = command.commands.find(
      (subcommand) => subcommand.name() === "check"
    );
    const syncCommand = command.commands.find(
      (subcommand) => subcommand.name() === "sync"
    );
    const exportCommand = command.commands.find(
      (subcommand) => subcommand.name() === "export"
    );

    const checkDocs = checkCommand?.commands.find(
      (subcommand) => subcommand.name() === "docs"
    );
    const syncDocs = syncCommand?.commands.find(
      (subcommand) => subcommand.name() === "docs"
    );
    const exportDocs = exportCommand?.commands.find(
      (subcommand) => subcommand.name() === "docs"
    );

    const commonFlags = [...DOCS_COMMON_OPTION_FLAGS];
    const exportFlags = [
      ...DOCS_COMMON_OPTION_FLAGS,
      ...DOCS_EXPORT_OPTION_FLAGS,
    ];

    expect(checkDocs?.options.map((option) => option.flags)).toEqual(
      commonFlags
    );
    expect(syncDocs?.options.map((option) => option.flags)).toEqual(
      commonFlags
    );
    expect(exportDocs?.options.map((option) => option.flags)).toEqual(
      exportFlags
    );
  });
});

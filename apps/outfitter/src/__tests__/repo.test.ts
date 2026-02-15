import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
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
      ["node", "repo", "check", "docs", "--cwd", "fixtures/workspace"],
      { from: "node" }
    );

    expect(capturedDocsCheckOptions).toBeDefined();
    expect(capturedDocsCheckOptions?.cwd).toBe(
      resolve(process.cwd(), "fixtures/workspace")
    );
  });

  test("routes `repo sync docs` and `repo export docs`", async () => {
    const command = createTestCommand();

    await command.parseAsync(["node", "repo", "sync", "docs"], {
      from: "node",
    });
    await command.parseAsync(
      ["node", "repo", "export", "docs", "--target", "llms"],
      { from: "node" }
    );

    expect(capturedDocsSyncOptions).toBeDefined();
    expect(capturedDocsExportOptions?.target).toBe("llms");
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

  test("supports legacy alias `repo check-exports`", async () => {
    const command = createTestCommand();

    await command.parseAsync(["node", "repo", "check-exports", "--json"], {
      from: "node",
    });

    expect(toolingCalls).toHaveLength(1);
    expect(toolingCalls[0]).toEqual({
      command: "check-exports",
      args: ["--json"],
      cwd: process.cwd(),
    });
  });

  test("supports subject aliases `readme-imports`, `bunup-registry`, and `clean-tree`", async () => {
    const command = createTestCommand();

    await command.parseAsync(
      ["node", "repo", "check", "readme-imports", "--json"],
      {
        from: "node",
      }
    );
    await command.parseAsync(["node", "repo", "check", "bunup-registry"], {
      from: "node",
    });
    await command.parseAsync(
      ["node", "repo", "check", "clean-tree", "--paths", "docs"],
      {
        from: "node",
      }
    );

    expect(toolingCalls).toHaveLength(3);
    expect(toolingCalls[0]).toEqual({
      command: "check-readme-imports",
      args: ["--json"],
      cwd: process.cwd(),
    });
    expect(toolingCalls[1]).toEqual({
      command: "check-bunup-registry",
      args: [],
      cwd: process.cwd(),
    });
    expect(toolingCalls[2]).toEqual({
      command: "check-clean-tree",
      args: ["--paths", "docs"],
      cwd: process.cwd(),
    });
  });
});

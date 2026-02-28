/**
 * Tests for `outfitter init --example` flag behavior.
 *
 * Verifies that `--example <name>` overlays pattern-rich example files
 * on top of the base preset scaffold.
 *
 * @see OS-353
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { setupInitTestHarness, tempDir } from "./helpers/init-test-harness.js";

setupInitTestHarness();

describe("init --example flag", () => {
  describe("CLI todo example", () => {
    test("scaffolds cli preset with todo example overlay", async () => {
      const { runInit } = await import("../commands/init.js");

      const result = await runInit({
        targetDir: tempDir,
        name: "my-todo-cli",
        preset: "cli",
        example: "todo",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.preset).toBe("cli");
      }
    });

    test("todo example uses builder patterns (.input, .context, .hints)", async () => {
      const { runInit } = await import("../commands/init.js");

      await runInit({
        targetDir: tempDir,
        name: "my-todo-cli",
        preset: "cli",
        example: "todo",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      const programPath = join(tempDir, "src", "program.ts");
      expect(existsSync(programPath)).toBe(true);

      const content = readFileSync(programPath, "utf-8");
      // Should demonstrate .input() with a Zod schema
      expect(content).toContain(".input(");
      // Should demonstrate .context() for async context construction
      expect(content).toContain(".context(");
      // Should demonstrate .hints() for post-command suggestions
      expect(content).toContain(".hints(");
      // Should demonstrate runHandler() lifecycle bridge
      expect(content).toContain("runHandler");
      // Should NOT be the default hello-world stub
      expect(content).not.toContain("hello [name]");
      expect(content).not.toContain("Say hello");
    });

    test("todo example has real todo domain logic (add, list, complete)", async () => {
      const { runInit } = await import("../commands/init.js");

      await runInit({
        targetDir: tempDir,
        name: "my-todo-cli",
        preset: "cli",
        example: "todo",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      const programPath = join(tempDir, "src", "program.ts");
      const content = readFileSync(programPath, "utf-8");

      // Should have multiple commands for todo operations
      expect(content).toContain("add");
      expect(content).toContain("list");
      expect(content).toContain("complete");
    });

    test("todo example preserves cli entry point and package structure", async () => {
      const { runInit } = await import("../commands/init.js");

      await runInit({
        targetDir: tempDir,
        name: "my-todo-cli",
        preset: "cli",
        example: "todo",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      // Entry point should still exist
      const cliPath = join(tempDir, "src", "cli.ts");
      expect(existsSync(cliPath)).toBe(true);

      // Package.json should still have cli preset structure
      const packageJson = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8")
      );
      expect(packageJson.outfitter.template.surfaces).toEqual(["cli"]);
    });
  });

  describe("MCP files example", () => {
    test("scaffolds mcp preset with files example overlay", async () => {
      const { runInit } = await import("../commands/init.js");

      const result = await runInit({
        targetDir: tempDir,
        name: "my-file-server",
        preset: "mcp",
        example: "files",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.preset).toBe("mcp");
      }
    });

    test("files example uses defineResource and defineTool patterns", async () => {
      const { runInit } = await import("../commands/init.js");

      await runInit({
        targetDir: tempDir,
        name: "my-file-server",
        preset: "mcp",
        example: "files",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      const mcpPath = join(tempDir, "src", "mcp.ts");
      expect(existsSync(mcpPath)).toBe(true);

      const content = readFileSync(mcpPath, "utf-8");
      // Should demonstrate defineResource for static resources
      expect(content).toContain("defineResource");
      // Should demonstrate defineResourceTemplate for parameterized resources
      expect(content).toContain("defineResourceTemplate");
      // Should demonstrate defineTool for file operations
      expect(content).toContain("defineTool");
      // Should use Result patterns
      expect(content).toContain("Result.ok");
      // Should NOT be the default hello-world stub
      expect(content).not.toContain("hello");
      expect(content).not.toContain("Say hello");
    });

    test("files example preserves mcp entry point and package structure", async () => {
      const { runInit } = await import("../commands/init.js");

      await runInit({
        targetDir: tempDir,
        name: "my-file-server",
        preset: "mcp",
        example: "files",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      // Entry point should still exist
      const serverPath = join(tempDir, "src", "server.ts");
      expect(existsSync(serverPath)).toBe(true);

      // Package.json should still have mcp preset structure
      const packageJson = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8")
      );
      expect(packageJson.outfitter.template.surfaces).toEqual(["mcp"]);
    });
  });

  describe("error handling", () => {
    test("rejects unknown example name for cli preset", async () => {
      const { runInit } = await import("../commands/init.js");

      const result = await runInit({
        targetDir: tempDir,
        name: "test-project",
        preset: "cli",
        example: "nonexistent",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("nonexistent");
        expect(result.error.message).toContain("todo");
      }
    });

    test("rejects unknown example name for mcp preset", async () => {
      const { runInit } = await import("../commands/init.js");

      const result = await runInit({
        targetDir: tempDir,
        name: "test-project",
        preset: "mcp",
        example: "nonexistent",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("nonexistent");
        expect(result.error.message).toContain("files");
      }
    });

    test("rejects --example for preset with no examples", async () => {
      const { runInit } = await import("../commands/init.js");

      const result = await runInit({
        targetDir: tempDir,
        name: "test-project",
        preset: "minimal",
        example: "todo",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toContain("minimal");
      }
    });
  });

  describe("without --example flag", () => {
    test("cli preset scaffolds default files when no example specified", async () => {
      const { runInit } = await import("../commands/init.js");

      await runInit({
        targetDir: tempDir,
        name: "test-project",
        preset: "cli",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
      });

      const programPath = join(tempDir, "src", "program.ts");
      const content = readFileSync(programPath, "utf-8");
      // Default hello-world stub
      expect(content).toContain("hello");
    });
  });

  describe("dry-run mode", () => {
    test("dry-run with --example reports planned operations without writing files", async () => {
      const { runInit } = await import("../commands/init.js");

      const result = await runInit({
        targetDir: tempDir,
        name: "test-project",
        preset: "cli",
        example: "todo",
        force: false,
        yes: true,
        noTooling: true,
        skipInstall: true,
        skipGit: true,
        dryRun: true,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.dryRunPlan).toBeDefined();
        // In dry-run, no files should be written
        expect(existsSync(join(tempDir, "src", "program.ts"))).toBe(false);
      }
    });
  });
});

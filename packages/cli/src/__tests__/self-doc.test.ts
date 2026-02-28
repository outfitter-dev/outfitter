/**
 * Tests for self-documenting root command.
 *
 * When no subcommand is given, createCLI() outputs the full command tree
 * as JSON (piped/JSON mode) or help text (TTY mode).
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { z } from "zod";

import { command, createCLI } from "../command.js";

// =============================================================================
// Test Utilities
// =============================================================================

interface CapturedOutput {
  readonly stderr: string;
  readonly stdout: string;
}

async function captureOutput(
  fn: () => void | Promise<void>
): Promise<CapturedOutput> {
  let stdoutContent = "";
  let stderrContent = "";

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    stdoutContent +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    stderrContent +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  try {
    await fn();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return { stdout: stdoutContent, stderr: stderrContent };
}

// =============================================================================
// Setup/Teardown
// =============================================================================

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  process.env = originalEnv;
  delete process.env.OUTFITTER_JSON;
  delete process.env.OUTFITTER_JSONL;
});

// =============================================================================
// Self-documenting root command — JSON mode
// =============================================================================

describe("self-documenting root command", () => {
  describe("JSON mode", () => {
    test("outputs command tree as JSON when no subcommand given", async () => {
      process.env.OUTFITTER_JSON = "1";

      const cli = createCLI({
        name: "my-tool",
        version: "1.0.0",
        description: "A test CLI tool",
        onExit: () => {},
      });

      cli.register(
        command("list")
          .description("List all items")
          .option("--limit <n>", "Max results", "20")
          .action(async () => {})
      );

      cli.register(
        command("get <id>")
          .description("Get item by ID")
          .action(async () => {})
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "my-tool"]);
      });

      const tree = JSON.parse(captured.stdout.trim());
      expect(tree.name).toBe("my-tool");
      expect(tree.version).toBe("1.0.0");
      expect(tree.description).toBe("A test CLI tool");
      expect(tree.commands).toBeArray();
      expect(tree.commands.length).toBeGreaterThanOrEqual(2);
    });

    test("command tree includes command descriptions", async () => {
      process.env.OUTFITTER_JSON = "1";

      const cli = createCLI({
        name: "test-cli",
        version: "0.1.0",
        onExit: () => {},
      });

      cli.register(
        command("deploy")
          .description("Deploy the application")
          .action(async () => {})
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "test-cli"]);
      });

      const tree = JSON.parse(captured.stdout.trim());
      const deployCmd = tree.commands.find(
        (c: { name: string }) => c.name === "deploy"
      );
      expect(deployCmd).toBeDefined();
      expect(deployCmd.description).toBe("Deploy the application");
    });

    test("command tree includes available options", async () => {
      process.env.OUTFITTER_JSON = "1";

      const cli = createCLI({
        name: "test-cli",
        version: "0.1.0",
        onExit: () => {},
      });

      cli.register(
        command("list")
          .description("List items")
          .option("--limit <n>", "Max results", "20")
          .option("--format <type>", "Output format")
          .action(async () => {})
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "test-cli"]);
      });

      const tree = JSON.parse(captured.stdout.trim());
      const listCmd = tree.commands.find(
        (c: { name: string }) => c.name === "list"
      );
      expect(listCmd).toBeDefined();
      expect(listCmd.options).toBeArray();
      expect(listCmd.options.length).toBeGreaterThanOrEqual(2);

      const limitOpt = listCmd.options.find(
        (o: { flags: string }) => o.flags === "--limit <n>"
      );
      expect(limitOpt).toBeDefined();
      expect(limitOpt.description).toBe("Max results");
    });

    test("command tree includes schema-derived options from .input()", async () => {
      process.env.OUTFITTER_JSON = "1";

      const cli = createCLI({
        name: "test-cli",
        version: "0.1.0",
        onExit: () => {},
      });

      cli.register(
        command("run")
          .description("Run a task")
          .input(
            z.object({
              name: z.string().describe("Task name"),
              verbose: z.boolean().optional().describe("Enable verbose output"),
            })
          )
          .action(async () => {})
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "test-cli"]);
      });

      const tree = JSON.parse(captured.stdout.trim());
      const runCmd = tree.commands.find(
        (c: { name: string }) => c.name === "run"
      );
      expect(runCmd).toBeDefined();
      expect(runCmd.options).toBeArray();

      // Should include schema-derived options
      const nameOpt = runCmd.options.find((o: { flags: string }) =>
        o.flags.includes("--name")
      );
      expect(nameOpt).toBeDefined();
    });

    test("structured command tree object has correct shape", async () => {
      process.env.OUTFITTER_JSON = "1";

      const cli = createCLI({
        name: "test-cli",
        version: "2.0.0",
        description: "Test tool",
        onExit: () => {},
      });

      cli.register(
        command("status")
          .description("Show status")
          .action(async () => {})
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "test-cli"]);
      });

      const tree = JSON.parse(captured.stdout.trim());

      // Required top-level fields
      expect(tree).toHaveProperty("name");
      expect(tree).toHaveProperty("version");
      expect(tree).toHaveProperty("commands");

      // Commands are objects with name and description
      for (const cmd of tree.commands) {
        expect(cmd).toHaveProperty("name");
        expect(typeof cmd.name).toBe("string");
      }
    });
  });

  // ===========================================================================
  // TTY mode — human-readable help text
  // ===========================================================================

  describe("TTY mode", () => {
    test("outputs human-readable help text when no subcommand given", async () => {
      const cli = createCLI({
        name: "my-tool",
        version: "1.0.0",
        description: "A test CLI tool",
        onExit: () => {},
      });

      cli.register(
        command("list")
          .description("List all items")
          .action(async () => {})
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "my-tool"]);
      });

      // Should contain help text elements
      const output = captured.stdout + captured.stderr;
      expect(output).toContain("my-tool");
      expect(output).toContain("list");
    });

    test("help text includes registered command names", async () => {
      const cli = createCLI({
        name: "test-cli",
        version: "0.1.0",
        onExit: () => {},
      });

      cli.register(
        command("deploy")
          .description("Deploy app")
          .action(async () => {})
      );

      cli.register(
        command("status")
          .description("Show status")
          .action(async () => {})
      );

      const captured = await captureOutput(async () => {
        await cli.parse(["node", "test-cli"]);
      });

      const output = captured.stdout + captured.stderr;
      expect(output).toContain("deploy");
      expect(output).toContain("status");
    });
  });
});

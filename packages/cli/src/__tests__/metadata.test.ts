/**
 * Tests for CommandBuilder.readOnly() and .idempotent() metadata signals.
 *
 * Covers:
 * - .readOnly(true) stores readOnly metadata on command (VAL-SAFE-004)
 * - .idempotent(true) stores idempotent metadata on command (VAL-SAFE-004)
 * - Default is non-read-only, non-idempotent
 * - Metadata included in self-documenting root command tree (JSON mode) (VAL-SAFE-004)
 * - Chainable with other builder methods
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { z } from "zod";

import { command, createCLI } from "../command.js";
import { buildCommandTree } from "../hints.js";

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
  delete process.env["OUTFITTER_JSON"];
  delete process.env["OUTFITTER_JSONL"];
});

// =============================================================================
// .readOnly() — read-only metadata signal
// =============================================================================

describe("CommandBuilder.readOnly()", () => {
  test(".readOnly(true) is chainable", () => {
    const builder = command("list")
      .description("List resources")
      .readOnly(true)
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("list");
  });

  test(".readOnly(false) is chainable", () => {
    const builder = command("delete")
      .description("Delete resources")
      .readOnly(false)
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("delete");
  });

  test("chains with other builder methods", () => {
    const builder = command("list")
      .description("List resources")
      .readOnly(true)
      .option("--limit <n>", "Max results")
      .input(z.object({ format: z.string().optional().describe("Format") }))
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("list");
  });
});

// =============================================================================
// .idempotent() — idempotent metadata signal
// =============================================================================

describe("CommandBuilder.idempotent()", () => {
  test(".idempotent(true) is chainable", () => {
    const builder = command("set")
      .description("Set a value")
      .idempotent(true)
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("set");
  });

  test(".idempotent(false) is chainable", () => {
    const builder = command("append")
      .description("Append data")
      .idempotent(false)
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("append");
  });

  test("chains with readOnly and other methods", () => {
    const builder = command("list")
      .description("List resources")
      .readOnly(true)
      .idempotent(true)
      .destructive(false)
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("list");
  });
});

// =============================================================================
// Metadata in Command Tree (JSON mode) — VAL-SAFE-004
// =============================================================================

describe("Command tree includes readOnly/idempotent metadata", () => {
  test("readOnly=true appears in command tree node", async () => {
    process.env.OUTFITTER_JSON = "1";

    const cli = createCLI({
      name: "test-cli",
      version: "1.0.0",
      onExit: () => {},
    });

    cli.register(
      command("list")
        .description("List resources")
        .readOnly(true)
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
    expect(listCmd.metadata).toBeDefined();
    expect(listCmd.metadata.readOnly).toBe(true);
  });

  test("idempotent=true appears in command tree node", async () => {
    process.env.OUTFITTER_JSON = "1";

    const cli = createCLI({
      name: "test-cli",
      version: "1.0.0",
      onExit: () => {},
    });

    cli.register(
      command("set")
        .description("Set a value")
        .idempotent(true)
        .action(async () => {})
    );

    const captured = await captureOutput(async () => {
      await cli.parse(["node", "test-cli"]);
    });

    const tree = JSON.parse(captured.stdout.trim());
    const setCmd = tree.commands.find(
      (c: { name: string }) => c.name === "set"
    );
    expect(setCmd).toBeDefined();
    expect(setCmd.metadata).toBeDefined();
    expect(setCmd.metadata.idempotent).toBe(true);
  });

  test("both readOnly and idempotent appear in command tree", async () => {
    process.env.OUTFITTER_JSON = "1";

    const cli = createCLI({
      name: "test-cli",
      version: "1.0.0",
      onExit: () => {},
    });

    cli.register(
      command("list")
        .description("List resources")
        .readOnly(true)
        .idempotent(true)
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
    expect(listCmd.metadata).toEqual({
      readOnly: true,
      idempotent: true,
    });
  });

  test("default (no readOnly/idempotent) omits metadata from command tree", async () => {
    process.env.OUTFITTER_JSON = "1";

    const cli = createCLI({
      name: "test-cli",
      version: "1.0.0",
      onExit: () => {},
    });

    cli.register(
      command("run")
        .description("Run something")
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
    // metadata should be absent when no signals are set
    expect(runCmd.metadata).toBeUndefined();
  });

  test("readOnly=false does not appear in metadata", async () => {
    process.env.OUTFITTER_JSON = "1";

    const cli = createCLI({
      name: "test-cli",
      version: "1.0.0",
      onExit: () => {},
    });

    cli.register(
      command("run")
        .description("Run something")
        .readOnly(false)
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
    // false values should not appear (only true values are meaningful)
    expect(runCmd.metadata).toBeUndefined();
  });

  test("buildCommandTree includes metadata directly", () => {
    const { Command } = require("commander");
    const program = new Command("test-cli").version("1.0.0");

    const listCmd = command("list")
      .description("List resources")
      .readOnly(true)
      .idempotent(true)
      .action(async () => {})
      .build();

    program.addCommand(listCmd);

    const tree = buildCommandTree(program);
    const listNode = tree.commands.find((c) => c.name === "list");
    expect(listNode).toBeDefined();
    expect(listNode!.metadata).toEqual({
      readOnly: true,
      idempotent: true,
    });
  });
});

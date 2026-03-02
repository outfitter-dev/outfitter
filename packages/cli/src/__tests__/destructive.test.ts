/**
 * Tests for CommandBuilder.destructive() — auto --dry-run flag and dry-run hints.
 *
 * Covers:
 * - .destructive(true) auto-adds --dry-run flag (VAL-SAFE-001)
 * - Flag deduplication when --dry-run is already present
 * - Default (no .destructive()) is non-destructive
 * - Dry-run response envelope includes real-command hint (VAL-SAFE-002)
 * - Live path (no --dry-run) executes normally (VAL-SAFE-003)
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { OutfitterError } from "@outfitter/contracts";
import { Result } from "better-result";
import { z } from "zod";

import { command, createCLI } from "../command.js";
import { runHandler } from "../envelope.js";
import { dryRunPreset } from "../flags.js";

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
let originalArgv: string[];

beforeEach(() => {
  originalEnv = { ...process.env };
  originalArgv = [...process.argv];
});

afterEach(() => {
  process.env = originalEnv;
  process.argv = originalArgv;
  delete process.env["OUTFITTER_JSON"];
  delete process.env["OUTFITTER_JSONL"];
});

// =============================================================================
// .destructive(true) — auto-adds --dry-run flag (VAL-SAFE-001)
// =============================================================================

describe("CommandBuilder.destructive()", () => {
  test(".destructive(true) auto-adds --dry-run flag to command", () => {
    const cmd = command("delete")
      .description("Delete resources")
      .destructive(true)
      .action(async () => {})
      .build();

    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).toContain("--dry-run");
  });

  test("--dry-run flag has correct description and default", () => {
    const cmd = command("delete")
      .description("Delete resources")
      .destructive(true)
      .action(async () => {})
      .build();

    const dryRunOpt = cmd.options.find((o) => o.long === "--dry-run");
    expect(dryRunOpt).toBeDefined();
    expect(dryRunOpt!.description).toContain("Preview");
    expect(dryRunOpt!.defaultValue).toBe(false);
  });

  test("default (no .destructive()) does not add --dry-run flag", () => {
    const cmd = command("list")
      .description("List resources")
      .action(async () => {})
      .build();

    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).not.toContain("--dry-run");
  });

  test(".destructive(false) does not add --dry-run flag", () => {
    const cmd = command("list")
      .description("List resources")
      .destructive(false)
      .action(async () => {})
      .build();

    const optionNames = cmd.options.map((o) => o.long);
    expect(optionNames).not.toContain("--dry-run");
  });

  test("deduplicates --dry-run when already added via .option()", () => {
    const cmd = command("delete")
      .description("Delete resources")
      .option("--dry-run", "Preview changes")
      .destructive(true)
      .action(async () => {})
      .build();

    const dryRunOptions = cmd.options.filter((o) => o.long === "--dry-run");
    expect(dryRunOptions).toHaveLength(1);
  });

  test("deduplicates --dry-run when already added via dryRunPreset()", () => {
    const cmd = command("delete")
      .description("Delete resources")
      .preset(dryRunPreset())
      .destructive(true)
      .action(async () => {})
      .build();

    const dryRunOptions = cmd.options.filter((o) => o.long === "--dry-run");
    expect(dryRunOptions).toHaveLength(1);
  });

  test("--dry-run flag is accessible in action handler", async () => {
    const cli = createCLI({ name: "test", version: "0.0.1" });
    let capturedDryRun: boolean | undefined;

    cli.register(
      command("delete")
        .description("Delete resources")
        .destructive(true)
        .action(async ({ flags }) => {
          capturedDryRun = Boolean(flags["dryRun"] ?? flags["dry-run"]);
        })
    );

    await cli.parse(["node", "test", "delete", "--dry-run"]);

    expect(capturedDryRun).toBe(true);
  });

  test("--dry-run defaults to false when not passed", async () => {
    const cli = createCLI({ name: "test", version: "0.0.1" });
    let capturedDryRun: boolean | undefined;

    cli.register(
      command("delete")
        .description("Delete resources")
        .destructive(true)
        .action(async ({ flags }) => {
          capturedDryRun = Boolean(flags["dryRun"] ?? flags["dry-run"]);
        })
    );

    await cli.parse(["node", "test", "delete"]);

    expect(capturedDryRun).toBe(false);
  });

  test("is chainable with other builder methods", () => {
    const builder = command("delete")
      .description("Delete resources")
      .destructive(true)
      .option("--force", "Force deletion")
      .input(z.object({ id: z.string().describe("Resource ID") }))
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("delete");
    expect(cmd.options.map((o) => o.long)).toContain("--dry-run");
    expect(cmd.options.map((o) => o.long)).toContain("--force");
  });
});

// =============================================================================
// runHandler() — Dry-Run Hint (VAL-SAFE-002)
// =============================================================================

describe("runHandler() dry-run hint", () => {
  test("dry-run response includes CLIHint with real command (without --dry-run)", async () => {
    process.argv = ["node", "test", "delete", "--id", "abc", "--dry-run"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "delete",
        handler: async () => Result.ok({ preview: true, items: 3 }),
        format: "json",
        dryRun: true,
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.hints).toBeDefined();

    const dryRunHint = envelope.hints.find(
      (h: { description: string }) =>
        h.description.toLowerCase().includes("without") ||
        h.description.toLowerCase().includes("execute") ||
        h.description.toLowerCase().includes("run for real")
    );
    expect(dryRunHint).toBeDefined();
    expect(dryRunHint.command).not.toContain("--dry-run");
  });

  test("dry-run hint command preserves other flags", async () => {
    process.argv = [
      "node",
      "test",
      "delete",
      "--id",
      "abc",
      "--force",
      "--dry-run",
    ];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "delete",
        handler: async () => Result.ok({ preview: true }),
        format: "json",
        dryRun: true,
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    const dryRunHint = envelope.hints.find(
      (h: { command: string }) => !h.command.includes("--dry-run")
    );
    expect(dryRunHint).toBeDefined();
    expect(dryRunHint.command).toContain("--id");
    expect(dryRunHint.command).toContain("--force");
  });

  test("dry-run hints compose with user-provided hints", async () => {
    process.argv = ["node", "test", "delete", "--id", "abc", "--dry-run"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "delete",
        handler: async () => Result.ok({ preview: true }),
        format: "json",
        dryRun: true,
        hints: () => [
          { description: "Check status", command: "status --id abc" },
        ],
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.hints).toBeDefined();
    // Should have both user hints and dry-run hint
    expect(envelope.hints.length).toBeGreaterThanOrEqual(2);

    const userHint = envelope.hints.find(
      (h: { command: string }) => h.command === "status --id abc"
    );
    expect(userHint).toBeDefined();

    const dryRunHint = envelope.hints.find(
      (h: { command: string }) => !h.command.includes("--dry-run")
    );
    expect(dryRunHint).toBeDefined();
  });
});

// =============================================================================
// Live Path — No --dry-run (VAL-SAFE-003)
// =============================================================================

describe("runHandler() live destructive execution", () => {
  test("without --dry-run, no dry-run hint is added", async () => {
    process.argv = ["node", "test", "delete", "--id", "abc"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "delete",
        handler: async () => Result.ok({ deleted: true }),
        format: "json",
        dryRun: false,
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    // No hints at all (no user hints or dry-run hints)
    expect("hints" in envelope).toBe(false);
  });

  test("without dryRun option, no dry-run hint is added", async () => {
    process.argv = ["node", "test", "delete", "--id", "abc"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "delete",
        handler: async () => Result.ok({ deleted: true }),
        format: "json",
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect("hints" in envelope).toBe(false);
  });

  test("live path executes normally with standard envelope", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "delete",
        handler: async () => Result.ok({ deleted: true, count: 5 }),
        format: "json",
        dryRun: false,
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("delete");
    expect(envelope.result).toEqual({ deleted: true, count: 5 });
  });
});

// =============================================================================
// E2E — Full destructive command flow
// =============================================================================

describe("Destructive command E2E flow", () => {
  test("full flow: .destructive(true) + runHandler with dryRun=true", async () => {
    const cli = createCLI({ name: "test", version: "0.0.1" });
    let handlerCalled = false;

    process.argv = ["node", "test", "cleanup", "--dry-run"];

    cli.register(
      command("cleanup")
        .description("Clean up old resources")
        .destructive(true)
        .action(async ({ flags }) => {
          const isDryRun = Boolean(flags["dryRun"] ?? flags["dry-run"]);
          handlerCalled = true;

          await runHandler({
            command: "cleanup",
            handler: async () => {
              if (isDryRun) {
                return Result.ok({ preview: true, wouldDelete: 10 });
              }
              return Result.ok({ deleted: 10 });
            },
            format: "json",
            dryRun: isDryRun,
          });
        })
    );

    const captured = await captureOutput(async () => {
      await cli.parse(["node", "test", "cleanup", "--dry-run"]);
    });

    expect(handlerCalled).toBe(true);

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.result).toEqual({ preview: true, wouldDelete: 10 });
    expect(envelope.hints).toBeDefined();

    // Should have a hint for running without --dry-run
    const realCommandHint = envelope.hints.find(
      (h: { command: string }) => !h.command.includes("--dry-run")
    );
    expect(realCommandHint).toBeDefined();
  });

  test("full flow: .destructive(true) + runHandler with dryRun=false (live)", async () => {
    const cli = createCLI({ name: "test", version: "0.0.1" });

    process.argv = ["node", "test", "cleanup"];

    cli.register(
      command("cleanup")
        .description("Clean up old resources")
        .destructive(true)
        .action(async ({ flags }) => {
          const isDryRun = Boolean(flags["dryRun"] ?? flags["dry-run"]);

          await runHandler({
            command: "cleanup",
            handler: async () => Result.ok({ deleted: 10 }),
            format: "json",
            dryRun: isDryRun,
          });
        })
    );

    const captured = await captureOutput(async () => {
      await cli.parse(["node", "test", "cleanup"]);
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.result).toEqual({ deleted: 10 });
    // No dry-run hints in live mode
    expect("hints" in envelope).toBe(false);
  });
});

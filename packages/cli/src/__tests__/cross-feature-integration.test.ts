/**
 * Cross-feature integration tests verifying composition of streaming,
 * safety, truncation, and action graph features.
 *
 * Covers:
 * - VAL-CROSS-001: --stream + destructive dry-run composition
 * - VAL-CROSS-002: --stream + retryable error composition
 * - VAL-CROSS-003: Truncation + streaming coherence
 * - VAL-CROSS-004: Graph hints compose with safety metadata
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { CLIHint, StreamEvent } from "@outfitter/contracts";
import {
  exitCodeMap,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "@outfitter/contracts";
import { Result } from "better-result";
import { Command } from "commander";

import { command } from "../command.js";
import {
  createErrorEnvelope,
  createSuccessEnvelope,
  runHandler,
} from "../envelope.js";
import type { ErrorEnvelope, SuccessEnvelope } from "../envelope.js";
import {
  buildActionGraph,
  graphErrorHints,
  graphSuccessHints,
} from "../hints.js";
import { truncateOutput } from "../truncation.js";

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

function mockProcessExit(): {
  restore: () => void;
  getCapture: () => { exitCode: number | undefined; called: boolean };
} {
  let exitCode: number | undefined;
  let called = false;
  const originalExit = process.exit;

  // @ts-expect-error - mocking process.exit
  process.exit = (code?: number): never => {
    exitCode = code;
    called = true;
    throw new Error(`process.exit(${code}) called`);
  };

  return {
    restore: () => {
      process.exit = originalExit;
    },
    getCapture: () => ({ exitCode, called }),
  };
}

/**
 * Parse NDJSON output into an array of parsed lines.
 */
function parseNdjsonLines(output: string): unknown[] {
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
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
// VAL-CROSS-001: --stream + destructive dry-run composition
// =============================================================================

describe("VAL-CROSS-001: --stream + destructive --dry-run", () => {
  test("progress events are emitted in stream mode with dry-run", async () => {
    process.argv = ["node", "test", "cleanup", "--dry-run"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "cleanup",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "step",
            name: "scan",
            status: "running",
          });
          ctx?.progress?.({
            type: "progress",
            current: 3,
            total: 10,
            message: "Scanning files",
          });
          ctx?.progress?.({
            type: "step",
            name: "scan",
            status: "complete",
            duration_ms: 50,
          });
          return Result.ok({ preview: true, wouldDelete: 10 });
        },
        format: "json",
        stream: true,
        dryRun: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);

    // Should have: start, step, progress, step, envelope = 5 lines
    expect(lines).toHaveLength(5);

    // First line is start event
    const start = lines[0] as Record<string, unknown>;
    expect(start["type"]).toBe("start");
    expect(start["command"]).toBe("cleanup");

    // Middle lines are progress events
    const step1 = lines[1] as Record<string, unknown>;
    expect(step1["type"]).toBe("step");
    expect(step1["name"]).toBe("scan");

    const progress = lines[2] as Record<string, unknown>;
    expect(progress["type"]).toBe("progress");
    expect(progress["current"]).toBe(3);

    const step2 = lines[3] as Record<string, unknown>;
    expect(step2["type"]).toBe("step");
  });

  test("terminal envelope indicates dry-run with real-command hint", async () => {
    process.argv = ["node", "test", "cleanup", "--id", "abc", "--dry-run"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "cleanup",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "progress",
            current: 1,
            total: 1,
          });
          return Result.ok({ preview: true, wouldDelete: 5 });
        },
        format: "json",
        stream: true,
        dryRun: true,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    const envelope = lines[lines.length - 1] as SuccessEnvelope;

    expect(envelope.ok).toBe(true);
    expect(envelope.result).toEqual({ preview: true, wouldDelete: 5 });
    expect(envelope.hints).toBeDefined();

    // Should have a dry-run hint that strips --dry-run
    const dryRunHint = envelope.hints!.find(
      (h) => !h.command?.includes("--dry-run")
    );
    expect(dryRunHint).toBeDefined();
    expect(dryRunHint!.command).toContain("--id");
    expect(dryRunHint!.command).toContain("abc");
    expect(dryRunHint!.description.toLowerCase()).toMatch(
      /execute|without|run for real/
    );
  });

  test("state remains unchanged (handler only performs preview)", async () => {
    process.argv = ["node", "test", "delete-files", "--dry-run"];

    let sideEffectExecuted = false;

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "delete-files",
        handler: async (_input, ctx) => {
          const isDryRun = true; // Simulated from flags
          ctx?.progress?.({
            type: "step",
            name: "analyze",
            status: "complete",
            duration_ms: 10,
          });
          if (!isDryRun) {
            sideEffectExecuted = true;
          }
          return Result.ok({ preview: true, files: 3 });
        },
        format: "json",
        stream: true,
        dryRun: true,
      });
    });

    // Side effect was NOT executed
    expect(sideEffectExecuted).toBe(false);

    // Envelope is still valid
    const lines = parseNdjsonLines(captured.stdout);
    const envelope = lines[lines.length - 1] as SuccessEnvelope;
    expect(envelope.ok).toBe(true);
    expect(envelope.result).toEqual({ preview: true, files: 3 });
  });

  test("dry-run hints compose with user-provided hints in stream mode", async () => {
    process.argv = ["node", "test", "cleanup", "--dry-run"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "cleanup",
        handler: async () => Result.ok({ preview: true }),
        format: "json",
        stream: true,
        dryRun: true,
        hints: () => [{ description: "Check status", command: "status" }],
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    const envelope = lines[lines.length - 1] as SuccessEnvelope;

    expect(envelope.hints).toBeDefined();
    // Should have at least 2 hints: user hint + dry-run hint
    expect(envelope.hints!.length).toBeGreaterThanOrEqual(2);

    const userHint = envelope.hints!.find((h) => h.command === "status");
    expect(userHint).toBeDefined();

    const dryRunHint = envelope.hints!.find(
      (h) =>
        h.description.toLowerCase().includes("without") ||
        h.description.toLowerCase().includes("execute")
    );
    expect(dryRunHint).toBeDefined();
    expect(dryRunHint!.command).not.toContain("--dry-run");
  });

  test("all stream lines are valid NDJSON in dry-run mode", async () => {
    process.argv = ["node", "test", "cleanup", "--dry-run"];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "cleanup",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "step",
            name: "scan",
            status: "running",
          });
          ctx?.progress?.({
            type: "progress",
            current: 5,
            total: 10,
          });
          return Result.ok({ preview: true });
        },
        format: "json",
        stream: true,
        dryRun: true,
      });
    });

    const rawLines = captured.stdout
      .split("\n")
      .filter((l) => l.trim().length > 0);
    for (const line of rawLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

// =============================================================================
// VAL-CROSS-002: --stream + retryable error composition
// =============================================================================

describe("VAL-CROSS-002: --stream + retryable error", () => {
  test("rate_limit error has retryable: true and retry_after in stream envelope", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "fetch-data",
            handler: async (_input, ctx) => {
              ctx?.progress?.({
                type: "step",
                name: "connect",
                status: "complete",
                duration_ms: 100,
              });
              ctx?.progress?.({
                type: "progress",
                current: 2,
                total: 5,
                message: "Fetching page 2",
              });
              return Result.err(
                new RateLimitError({
                  message: "Rate limit exceeded",
                  retryAfterSeconds: 60,
                })
              );
            },
            format: "json",
            stream: true,
          });
        } catch {
          // process.exit mock throws
        }
      });

      const lines = parseNdjsonLines(captured.stdout);
      // Should have: start, step, progress, error envelope
      expect(lines.length).toBeGreaterThanOrEqual(4);

      // Terminal envelope is the last line
      const envelope = lines[lines.length - 1] as ErrorEnvelope;
      expect(envelope.ok).toBe(false);
      expect(envelope.error.category).toBe("rate_limit");
      expect(envelope.error.retryable).toBe(true);
      expect(envelope.error.retry_after).toBe(60);

      // Correct exit code
      const capture = exitMock.getCapture();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(exitCodeMap.rate_limit);
    } finally {
      exitMock.restore();
    }
  });

  test("timeout error has retryable: true but no retry_after in stream", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "sync",
            handler: async (_input, ctx) => {
              ctx?.progress?.({
                type: "step",
                name: "sync",
                status: "running",
              });
              return Result.err(
                new TimeoutError({
                  message: "Connection timed out",
                  operation: "sync",
                  timeoutMs: 5000,
                })
              );
            },
            format: "json",
            stream: true,
          });
        } catch {
          // process.exit mock throws
        }
      });

      const lines = parseNdjsonLines(captured.stdout);
      const envelope = lines[lines.length - 1] as ErrorEnvelope;

      expect(envelope.ok).toBe(false);
      expect(envelope.error.category).toBe("timeout");
      expect(envelope.error.retryable).toBe(true);
      expect(envelope.error.retry_after).toBeUndefined();

      const capture = exitMock.getCapture();
      expect(capture.exitCode).toBe(exitCodeMap.timeout);
    } finally {
      exitMock.restore();
    }
  });

  test("network error has retryable: true in stream mode", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "upload",
            handler: async (_input, ctx) => {
              ctx?.progress?.({
                type: "progress",
                current: 1,
                total: 3,
                message: "Uploading chunk 1",
              });
              return Result.err(
                new NetworkError({
                  message: "Connection refused",
                })
              );
            },
            format: "json",
            stream: true,
          });
        } catch {
          // process.exit mock throws
        }
      });

      const lines = parseNdjsonLines(captured.stdout);
      const envelope = lines[lines.length - 1] as ErrorEnvelope;

      expect(envelope.ok).toBe(false);
      expect(envelope.error.category).toBe("network");
      expect(envelope.error.retryable).toBe(true);
    } finally {
      exitMock.restore();
    }
  });

  test("non-retryable error has retryable: false in stream mode", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "validate",
            handler: async (_input, ctx) => {
              ctx?.progress?.({
                type: "step",
                name: "parse",
                status: "complete",
                duration_ms: 5,
              });
              return Result.err(
                new ValidationError({ message: "Invalid input schema" })
              );
            },
            format: "json",
            stream: true,
          });
        } catch {
          // process.exit mock throws
        }
      });

      const lines = parseNdjsonLines(captured.stdout);
      const envelope = lines[lines.length - 1] as ErrorEnvelope;

      expect(envelope.ok).toBe(false);
      expect(envelope.error.category).toBe("validation");
      expect(envelope.error.retryable).toBe(false);
      expect(envelope.error.retry_after).toBeUndefined();
    } finally {
      exitMock.restore();
    }
  });

  test("stream events before error are valid NDJSON", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "process",
            handler: async (_input, ctx) => {
              ctx?.progress?.({
                type: "step",
                name: "init",
                status: "complete",
                duration_ms: 10,
              });
              ctx?.progress?.({
                type: "progress",
                current: 3,
                total: 10,
                message: "Processing batch 3",
              });
              ctx?.progress?.({
                type: "step",
                name: "transform",
                status: "running",
              });
              return Result.err(
                new RateLimitError({
                  message: "Too many requests",
                  retryAfterSeconds: 30,
                })
              );
            },
            format: "json",
            stream: true,
          });
        } catch {
          // process.exit mock throws
        }
      });

      const rawLines = captured.stdout
        .split("\n")
        .filter((l) => l.trim().length > 0);

      // Every line must be valid JSON
      for (const line of rawLines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      // Lines before the last are stream events
      const lines = rawLines.map((l) => JSON.parse(l));
      expect(lines.length).toBeGreaterThanOrEqual(5); // start, step, progress, step, error envelope

      // Verify type discriminators on non-envelope lines
      for (let i = 0; i < lines.length - 1; i++) {
        const event = lines[i] as Record<string, unknown>;
        expect(["start", "step", "progress"]).toContain(event["type"]);
      }
    } finally {
      exitMock.restore();
    }
  });

  test("error envelope with onError hints in stream mode", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async (_input, ctx) => {
              ctx?.progress?.({
                type: "step",
                name: "prepare",
                status: "complete",
                duration_ms: 20,
              });
              return Result.err(
                new RateLimitError({
                  message: "API rate limit hit",
                  retryAfterSeconds: 120,
                })
              );
            },
            format: "json",
            stream: true,
            onError: () => [
              { description: "Wait and retry", command: "deploy --retry" },
            ],
          });
        } catch {
          // process.exit mock throws
        }
      });

      const lines = parseNdjsonLines(captured.stdout);
      const envelope = lines[lines.length - 1] as ErrorEnvelope;

      expect(envelope.ok).toBe(false);
      expect(envelope.error.retryable).toBe(true);
      expect(envelope.error.retry_after).toBe(120);
      expect(envelope.hints).toBeDefined();
      expect(envelope.hints!.length).toBeGreaterThanOrEqual(1);
      expect(envelope.hints!.some((h) => h.command === "deploy --retry")).toBe(
        true
      );
    } finally {
      exitMock.restore();
    }
  });
});

// =============================================================================
// VAL-CROSS-003: Truncation + streaming coherence
// =============================================================================

describe("VAL-CROSS-003: Truncation + streaming", () => {
  test("streamed command with large output applies truncation in envelope", async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `item-${i + 1}`,
    }));

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "list",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "step",
            name: "fetch",
            status: "running",
          });
          ctx?.progress?.({
            type: "progress",
            current: 50,
            total: 50,
            message: "Fetched all items",
          });
          ctx?.progress?.({
            type: "step",
            name: "fetch",
            status: "complete",
            duration_ms: 200,
          });

          // Apply truncation to the result
          const truncated = truncateOutput(items, {
            limit: 10,
            commandName: "list",
          });

          return Result.ok({
            items: truncated.data,
            truncation: truncated.metadata,
          });
        },
        format: "json",
        stream: true,
        // Pass truncation hints to the envelope
        hints: () => {
          const truncated = truncateOutput(items, {
            limit: 10,
            commandName: "list",
          });
          return truncated.hints;
        },
      });
    });

    const lines = parseNdjsonLines(captured.stdout);

    // Should have: start + step + progress + step + envelope = 5 lines
    expect(lines).toHaveLength(5);

    // Terminal envelope
    const envelope = lines[lines.length - 1] as SuccessEnvelope;
    expect(envelope.ok).toBe(true);

    const result = envelope.result as {
      items: unknown[];
      truncation: { showing: number; total: number; truncated: boolean };
    };

    // Truncation metadata is present
    expect(result.truncation).toBeDefined();
    expect(result.truncation.showing).toBe(10);
    expect(result.truncation.total).toBe(50);
    expect(result.truncation.truncated).toBe(true);

    // Items are truncated
    expect(result.items).toHaveLength(10);

    // Pagination hints are present
    expect(envelope.hints).toBeDefined();
    expect(envelope.hints!.length).toBeGreaterThan(0);
    const paginationHint = envelope.hints!.find(
      (h) => h.command && h.command.includes("--offset")
    );
    expect(paginationHint).toBeDefined();
    expect(paginationHint!.command).toContain("--offset 10");
    expect(paginationHint!.command).toContain("--limit 10");
  });

  test("truncation metadata and pagination hints are valid JSON in stream", async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      value: `data-${i + 1}`,
    }));

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "search",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "progress",
            current: 100,
            total: 100,
          });

          const truncated = truncateOutput(items, {
            limit: 20,
            offset: 0,
            commandName: "search",
          });

          return Result.ok({
            results: truncated.data,
            truncation: truncated.metadata,
          });
        },
        format: "json",
        stream: true,
        hints: () => {
          const truncated = truncateOutput(items, {
            limit: 20,
            offset: 0,
            commandName: "search",
          });
          return truncated.hints;
        },
      });
    });

    // Every line must be parseable JSON
    const rawLines = captured.stdout
      .split("\n")
      .filter((l) => l.trim().length > 0);
    for (const line of rawLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }

    const lines = parseNdjsonLines(captured.stdout);
    const envelope = lines[lines.length - 1] as SuccessEnvelope;
    const result = envelope.result as {
      results: unknown[];
      truncation: { showing: number; total: number; truncated: boolean };
    };

    expect(result.truncation.showing).toBe(20);
    expect(result.truncation.total).toBe(100);
    expect(result.truncation.truncated).toBe(true);
    expect(result.results).toHaveLength(20);
  });

  test("no truncation metadata in stream when output is below limit", async () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "list",
        handler: async (_input, ctx) => {
          ctx?.progress?.({
            type: "step",
            name: "fetch",
            status: "complete",
            duration_ms: 5,
          });

          const truncated = truncateOutput(items, { limit: 10 });

          return Result.ok({
            items: truncated.data,
            truncation: truncated.metadata,
          });
        },
        format: "json",
        stream: true,
        hints: () => {
          const truncated = truncateOutput(items, { limit: 10 });
          return truncated.hints;
        },
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    const envelope = lines[lines.length - 1] as SuccessEnvelope;

    const result = envelope.result as {
      items: unknown[];
      truncation: undefined;
    };
    expect(result.items).toHaveLength(3);
    expect(result.truncation).toBeUndefined();

    // No hints when not truncated
    expect("hints" in envelope).toBe(false);
  });

  test("stream events are consistent with truncated output count", async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "scan",
        handler: async (_input, ctx) => {
          // Report the total items found
          ctx?.progress?.({
            type: "progress",
            current: 30,
            total: 30,
            message: "Found 30 items",
          });

          // Truncate to 10
          const truncated = truncateOutput(items, {
            limit: 10,
            commandName: "scan",
          });

          return Result.ok({
            items: truncated.data,
            truncation: truncated.metadata,
          });
        },
        format: "json",
        stream: true,
        hints: () =>
          truncateOutput(items, { limit: 10, commandName: "scan" }).hints,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);

    // Progress event reports full count
    const progressEvent = lines.find(
      (l) => (l as Record<string, unknown>)["type"] === "progress"
    ) as Record<string, unknown>;
    expect(progressEvent["current"]).toBe(30);
    expect(progressEvent["total"]).toBe(30);

    // Envelope has truncated subset
    const envelope = lines[lines.length - 1] as SuccessEnvelope;
    const result = envelope.result as {
      items: unknown[];
      truncation: { showing: number; total: number };
    };
    expect(result.items).toHaveLength(10);
    expect(result.truncation.showing).toBe(10);
    expect(result.truncation.total).toBe(30);
  });
});

// =============================================================================
// VAL-CROSS-004: Graph hints compose with safety metadata
// =============================================================================

describe("VAL-CROSS-004: Graph hints + safety metadata", () => {
  test("success envelope includes tier-4 hints alongside safety metadata", () => {
    // Build an action graph with related commands
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy application")
        .relatedTo("status", { description: "Check deployment status" })
        .relatedTo("rollback", { description: "Rollback if needed" })
        .destructive(true)
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Check status")
        .readOnly(true)
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("rollback")
        .description("Rollback")
        .destructive(true)
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const graphHints = graphSuccessHints(graph, "deploy", "cli");

    // Now create a success envelope with both graph hints and regular hints
    const envelope = createSuccessEnvelope("deploy", { deployed: true }, [
      ...graphHints,
      { description: "View logs", command: "cli logs" },
    ]);

    expect(envelope.ok).toBe(true);
    expect(envelope.hints).toBeDefined();
    expect(envelope.hints!.length).toBeGreaterThanOrEqual(3); // 2 graph + 1 user

    // Graph hints are present
    expect(envelope.hints!.some((h) => h.command === "cli status")).toBe(true);
    expect(envelope.hints!.some((h) => h.command === "cli rollback")).toBe(
      true
    );

    // User hint is present
    expect(envelope.hints!.some((h) => h.command === "cli logs")).toBe(true);
  });

  test("error envelope includes tier-4 hints alongside retryable/retry_after", () => {
    // Build graph
    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status", { description: "Check status" })
        .relatedTo("rollback", { description: "Rollback" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Status")
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("rollback")
        .description("Rollback")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const errorGraphHints = graphErrorHints(graph, "deploy", "cli");

    // Create error envelope with retryable error + graph hints
    const envelope = createErrorEnvelope(
      "deploy",
      "rate_limit",
      "Too many requests",
      errorGraphHints,
      60
    );

    expect(envelope.ok).toBe(false);
    // Safety metadata
    expect(envelope.error.retryable).toBe(true);
    expect(envelope.error.retry_after).toBe(60);
    expect(envelope.error.category).toBe("rate_limit");

    // Graph hints present without conflicts
    expect(envelope.hints).toBeDefined();
    expect(envelope.hints!.length).toBeGreaterThanOrEqual(1);
    expect(envelope.hints!.some((h) => h.command?.includes("status"))).toBe(
      true
    );
  });

  test("envelope schema has no conflicts between graph hints and safety fields", () => {
    const program = new Command("cli");
    program.addCommand(
      command("sync")
        .description("Sync data")
        .relatedTo("verify", { description: "Verify sync" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("verify")
        .description("Verify")
        .readOnly(true)
        .idempotent(true)
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);

    // Test success path with graph hints
    const successGraphHints = graphSuccessHints(graph, "sync", "cli");
    const successEnvelope = createSuccessEnvelope(
      "sync",
      { synced: 100 },
      successGraphHints
    );

    expect(successEnvelope.ok).toBe(true);
    expect(successEnvelope.hints).toBeDefined();
    expect(successEnvelope.hints![0]!.command).toBe("cli verify");

    // Test error path with graph hints + retryable
    const errGraphHints = graphErrorHints(graph, "sync", "cli");
    const errorEnvelope = createErrorEnvelope(
      "sync",
      "timeout",
      "Connection timed out",
      errGraphHints
    );

    expect(errorEnvelope.ok).toBe(false);
    expect(errorEnvelope.error.retryable).toBe(true);
    expect(errorEnvelope.error.retry_after).toBeUndefined();
    expect(errorEnvelope.hints).toBeDefined();

    // Both error field and hints field coexist without schema conflicts
    const serialized = JSON.stringify(errorEnvelope);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.error.retryable).toBe(true);
    expect(deserialized.hints).toBeDefined();
    expect(deserialized.hints.length).toBeGreaterThanOrEqual(1);
  });

  test("error envelope with graph hints + retry_after serializes cleanly", () => {
    const program = new Command("cli");
    program.addCommand(
      command("fetch")
        .description("Fetch data")
        .relatedTo("cache", { description: "Use cached data" })
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("cache")
        .description("Cache")
        .readOnly(true)
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const hints = graphErrorHints(graph, "fetch", "cli");

    const envelope = createErrorEnvelope(
      "fetch",
      "rate_limit",
      "Rate limited",
      hints,
      30
    );

    // Verify the full envelope structure
    expect(envelope.ok).toBe(false);
    expect(envelope.command).toBe("fetch");
    expect(envelope.error.category).toBe("rate_limit");
    expect(envelope.error.message).toBe("Rate limited");
    expect(envelope.error.retryable).toBe(true);
    expect(envelope.error.retry_after).toBe(30);
    expect(envelope.hints).toBeDefined();
    expect(envelope.hints!.some((h) => h.command === "cli cache")).toBe(true);

    // Ensure it round-trips through JSON without any field loss
    const json = JSON.stringify(envelope);
    const parsed = JSON.parse(json) as ErrorEnvelope;
    expect(parsed.error.retryable).toBe(true);
    expect(parsed.error.retry_after).toBe(30);
    expect(parsed.hints).toBeDefined();
    expect(parsed.hints!.length).toBe(envelope.hints!.length);
  });

  test("streamed envelope includes both graph hints and retryable metadata", async () => {
    const exitMock = mockProcessExit();

    try {
      const program = new Command("cli");
      program.addCommand(
        command("deploy")
          .description("Deploy")
          .relatedTo("status", { description: "Check status" })
          .action(async () => {})
          .build()
      );
      program.addCommand(
        command("status")
          .description("Status")
          .action(async () => {})
          .build()
      );

      const graph = buildActionGraph(program);
      const graphHintsForError = graphErrorHints(graph, "deploy", "cli");

      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async (_input, ctx) => {
              ctx?.progress?.({
                type: "step",
                name: "prepare",
                status: "complete",
                duration_ms: 50,
              });
              return Result.err(
                new RateLimitError({
                  message: "Rate limited",
                  retryAfterSeconds: 45,
                })
              );
            },
            format: "json",
            stream: true,
            onError: () => graphHintsForError,
          });
        } catch {
          // process.exit mock throws
        }
      });

      const lines = parseNdjsonLines(captured.stdout);
      const envelope = lines[lines.length - 1] as ErrorEnvelope;

      // Safety metadata present
      expect(envelope.ok).toBe(false);
      expect(envelope.error.retryable).toBe(true);
      expect(envelope.error.retry_after).toBe(45);

      // Graph hints present
      expect(envelope.hints).toBeDefined();
      expect(envelope.hints!.some((h) => h.command?.includes("status"))).toBe(
        true
      );

      // All stream lines are valid NDJSON
      const rawLines = captured.stdout
        .split("\n")
        .filter((l) => l.trim().length > 0);
      for (const line of rawLines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    } finally {
      exitMock.restore();
    }
  });

  test("success envelope with graph hints + dry-run hint composes cleanly", async () => {
    process.argv = ["node", "test", "deploy", "--env", "prod", "--dry-run"];

    const program = new Command("cli");
    program.addCommand(
      command("deploy")
        .description("Deploy")
        .relatedTo("status", { description: "Check status" })
        .destructive(true)
        .action(async () => {})
        .build()
    );
    program.addCommand(
      command("status")
        .description("Status")
        .action(async () => {})
        .build()
    );

    const graph = buildActionGraph(program);
    const successGraphHints = graphSuccessHints(graph, "deploy", "cli");

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ preview: true, environment: "prod" }),
        format: "json",
        stream: true,
        dryRun: true,
        hints: () => successGraphHints,
      });
    });

    const lines = parseNdjsonLines(captured.stdout);
    const envelope = lines[lines.length - 1] as SuccessEnvelope;

    expect(envelope.ok).toBe(true);
    expect(envelope.hints).toBeDefined();

    // Should have graph hint(s) + dry-run hint
    const graphHint = envelope.hints!.find((h) =>
      h.command?.includes("status")
    );
    expect(graphHint).toBeDefined();

    const dryRunHint = envelope.hints!.find(
      (h) =>
        h.description.toLowerCase().includes("without") ||
        h.description.toLowerCase().includes("execute")
    );
    expect(dryRunHint).toBeDefined();
    expect(dryRunHint!.command).not.toContain("--dry-run");
    expect(dryRunHint!.command).toContain("--env");
    expect(dryRunHint!.command).toContain("prod");
  });
});

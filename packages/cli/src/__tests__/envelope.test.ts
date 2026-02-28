/**
 * Tests for output.envelope() and runHandler() lifecycle bridge.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { CLIHint, ErrorCategory } from "@outfitter/contracts";
import { exitCodeMap, ValidationError } from "@outfitter/contracts";
import { Result } from "better-result";

import {
  createErrorEnvelope,
  createSuccessEnvelope,
  runHandler,
} from "../envelope.js";
import type { CommandEnvelope } from "../envelope.js";

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
// createSuccessEnvelope()
// =============================================================================

describe("createSuccessEnvelope()", () => {
  test("wraps payload in { ok: true, command, result } structure", () => {
    const envelope = createSuccessEnvelope("deploy", { status: "deployed" });

    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("deploy");
    expect(envelope.result).toEqual({ status: "deployed" });
  });

  test("includes hints when provided", () => {
    const hints: CLIHint[] = [
      { description: "Check status", command: "deploy status" },
    ];
    const envelope = createSuccessEnvelope("deploy", { ok: true }, hints);

    expect(envelope.hints).toEqual(hints);
  });

  test("hints field is absent (not empty array) when no hints", () => {
    const envelope = createSuccessEnvelope("deploy", { ok: true });

    expect("hints" in envelope).toBe(false);
    expect(envelope.hints).toBeUndefined();
  });

  test("hints field is absent when hints array is empty", () => {
    const envelope = createSuccessEnvelope("deploy", { ok: true }, []);

    expect("hints" in envelope).toBe(false);
    expect(envelope.hints).toBeUndefined();
  });

  test("handles null result", () => {
    const envelope = createSuccessEnvelope("clear", null);

    expect(envelope.ok).toBe(true);
    expect(envelope.result).toBeNull();
  });

  test("handles complex result objects", () => {
    const result = {
      items: [{ id: 1 }, { id: 2 }],
      total: 2,
      cursor: "abc",
    };
    const envelope = createSuccessEnvelope("list", result);

    expect(envelope.result).toEqual(result);
  });
});

// =============================================================================
// createErrorEnvelope()
// =============================================================================

describe("createErrorEnvelope()", () => {
  test("wraps error in { ok: false, command, error } structure", () => {
    const envelope = createErrorEnvelope("deploy", "validation", "Invalid env");

    expect(envelope.ok).toBe(false);
    expect(envelope.command).toBe("deploy");
    expect(envelope.error).toEqual({
      category: "validation",
      message: "Invalid env",
    });
  });

  test("includes hints when provided", () => {
    const hints: CLIHint[] = [
      { description: "Try --force", command: "deploy --force" },
    ];
    const envelope = createErrorEnvelope(
      "deploy",
      "conflict",
      "Version mismatch",
      hints
    );

    expect(envelope.hints).toEqual(hints);
  });

  test("hints field is absent (not empty array) when no hints", () => {
    const envelope = createErrorEnvelope("deploy", "internal", "Unexpected");

    expect("hints" in envelope).toBe(false);
    expect(envelope.hints).toBeUndefined();
  });

  test("hints field is absent when hints array is empty", () => {
    const envelope = createErrorEnvelope(
      "deploy",
      "internal",
      "Unexpected",
      []
    );

    expect("hints" in envelope).toBe(false);
    expect(envelope.hints).toBeUndefined();
  });

  test("preserves all error categories", () => {
    const categories: ErrorCategory[] = [
      "validation",
      "not_found",
      "conflict",
      "permission",
      "timeout",
      "rate_limit",
      "network",
      "internal",
      "auth",
      "cancelled",
    ];

    for (const category of categories) {
      const envelope = createErrorEnvelope(
        "test",
        category,
        `${category} error`
      );
      expect(envelope.error.category).toBe(category);
    }
  });
});

// =============================================================================
// runHandler() — Success Path
// =============================================================================

describe("runHandler() success path", () => {
  test("produces ok: true with result for successful handler", async () => {
    process.env.OUTFITTER_JSON = "1";

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ status: "deployed" }),
        format: "json",
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("deploy");
    expect(envelope.result).toEqual({ status: "deployed" });
  });

  test("exits with code 0 on success (does not call process.exit)", async () => {
    const exitMock = mockProcessExit();

    try {
      await captureOutput(async () => {
        await runHandler({
          command: "list",
          handler: async () => Result.ok([1, 2, 3]),
          format: "json",
        });
      });

      // runHandler should NOT call process.exit on success
      expect(exitMock.getCapture().called).toBe(false);
    } finally {
      exitMock.restore();
    }
  });

  test("generates success hints from hint function", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ env: "prod" }),
        input: { env: "prod" },
        format: "json",
        hints: (_result, _input) => [
          { description: "Check status", command: "deploy status --env prod" },
        ],
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.hints).toHaveLength(1);
    expect(envelope.hints[0].command).toBe("deploy status --env prod");
  });

  test("omits hints when hint function returns empty array", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ ok: true }),
        format: "json",
        hints: () => [],
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect("hints" in envelope).toBe(false);
  });
});

// =============================================================================
// runHandler() — Error Path
// =============================================================================

describe("runHandler() error path", () => {
  test("produces ok: false with error category and message", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async () =>
              Result.err(
                new ValidationError({ message: "Missing env parameter" })
              ),
            format: "json",
          });
        } catch {
          // process.exit mock throws
        }
      });

      const envelope = JSON.parse(captured.stderr.trim());
      expect(envelope.ok).toBe(false);
      expect(envelope.command).toBe("deploy");
      expect(envelope.error.category).toBe("validation");
      expect(envelope.error.message).toBe("Missing env parameter");
    } finally {
      exitMock.restore();
    }
  });

  test("exits with mapped exit code from error taxonomy", async () => {
    const exitMock = mockProcessExit();

    try {
      await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async () =>
              Result.err(new ValidationError({ message: "Bad input" })),
            format: "json",
          });
        } catch {
          // process.exit mock throws
        }
      });

      const capture = exitMock.getCapture();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(exitCodeMap.validation); // 1
    } finally {
      exitMock.restore();
    }
  });

  test("generates error hints from onError function", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async () =>
              Result.err(new ValidationError({ message: "Invalid config" })),
            input: { env: "prod" },
            format: "json",
            onError: (_error, _input) => [
              { description: "Validate config", command: "deploy validate" },
            ],
          });
        } catch {
          // process.exit mock throws
        }
      });

      const envelope = JSON.parse(captured.stderr.trim());
      expect(envelope.ok).toBe(false);
      expect(envelope.hints).toHaveLength(1);
      expect(envelope.hints[0].command).toBe("deploy validate");
    } finally {
      exitMock.restore();
    }
  });

  test("maps all error categories to correct exit codes", async () => {
    const categories: Array<{
      category: ErrorCategory;
      exitCode: number;
    }> = [
      { category: "validation", exitCode: 1 },
      { category: "not_found", exitCode: 2 },
      { category: "conflict", exitCode: 3 },
      { category: "permission", exitCode: 4 },
      { category: "timeout", exitCode: 5 },
      { category: "rate_limit", exitCode: 6 },
      { category: "network", exitCode: 7 },
      { category: "internal", exitCode: 8 },
      { category: "auth", exitCode: 9 },
      { category: "cancelled", exitCode: 130 },
    ];

    for (const { category, exitCode } of categories) {
      const exitMock = mockProcessExit();

      try {
        // Create a duck-typed error with the appropriate category
        const error = Object.assign(new Error(`${category} error`), {
          _tag: "TestError",
          category,
        });

        await captureOutput(async () => {
          try {
            await runHandler({
              command: "test",
              handler: async () => Result.err(error as never),
              format: "json",
            });
          } catch {
            // process.exit mock throws
          }
        });

        const capture = exitMock.getCapture();
        expect(capture.called).toBe(true);
        expect(capture.exitCode).toBe(exitCode);
      } finally {
        exitMock.restore();
      }
    }
  });
});

// =============================================================================
// runHandler() — Context Factory
// =============================================================================

describe("runHandler() context factory", () => {
  test("calls context factory before handler", async () => {
    const callOrder: string[] = [];

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        contextFactory: async () => {
          callOrder.push("context");
          return { db: "connected" };
        },
        handler: async (_input, ctx) => {
          callOrder.push("handler");
          expect(ctx).toEqual({ db: "connected" });
          return Result.ok({ deployed: true });
        },
        format: "json",
      });
    });

    expect(callOrder).toEqual(["context", "handler"]);
    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
  });

  test("passes input to context factory", async () => {
    let factoryInput: unknown;

    await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        input: { env: "staging" },
        contextFactory: async (input) => {
          factoryInput = input;
          return {};
        },
        handler: async () => Result.ok({ ok: true }),
        format: "json",
      });
    });

    expect(factoryInput).toEqual({ env: "staging" });
  });

  test("handles context factory errors with proper exit code", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            contextFactory: async () => {
              throw new Error("DB connection failed");
            },
            handler: async () => Result.ok({ ok: true }),
            format: "json",
          });
        } catch {
          // process.exit mock throws
        }
      });

      const capture = exitMock.getCapture();
      expect(capture.called).toBe(true);

      // Should produce an error envelope
      const envelope = JSON.parse(captured.stderr.trim());
      expect(envelope.ok).toBe(false);
      expect(envelope.error.message).toBe("DB connection failed");
    } finally {
      exitMock.restore();
    }
  });

  test("does not call handler when context factory throws", async () => {
    const exitMock = mockProcessExit();
    let handlerCalled = false;

    try {
      await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            contextFactory: async () => {
              throw new Error("Context failed");
            },
            handler: async () => {
              handlerCalled = true;
              return Result.ok({ ok: true });
            },
            format: "json",
          });
        } catch {
          // process.exit mock throws
        }
      });

      expect(handlerCalled).toBe(false);
    } finally {
      exitMock.restore();
    }
  });
});

// =============================================================================
// runHandler() — Human Mode Output
// =============================================================================

describe("runHandler() human mode output", () => {
  test("renders success result as readable text", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ status: "deployed", env: "prod" }),
        format: "human",
      });
    });

    // Human mode should output readable text, not raw JSON
    expect(captured.stdout).toContain("status");
    expect(captured.stdout).toContain("deployed");
    expect(captured.stdout).not.toContain('"ok":true');
  });

  test("renders error to stderr in human mode", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async () =>
              Result.err(
                new ValidationError({ message: "Missing required field" })
              ),
            format: "human",
          });
        } catch {
          // process.exit mock throws
        }
      });

      // Error should go to stderr
      expect(captured.stderr).toContain("Missing required field");
    } finally {
      exitMock.restore();
    }
  });

  test("renders hints as suggestions in human mode", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "deploy",
        handler: async () => Result.ok({ ok: true }),
        format: "human",
        hints: () => [
          { description: "Check deploy status", command: "deploy status" },
        ],
      });
    });

    expect(captured.stdout).toContain("deploy status");
  });
});

// =============================================================================
// runHandler() — JSON Mode Output
// =============================================================================

describe("runHandler() JSON mode output", () => {
  test("renders full envelope as JSON on success", async () => {
    const captured = await captureOutput(async () => {
      await runHandler({
        command: "list",
        handler: async () => Result.ok({ items: [1, 2, 3] }),
        format: "json",
      });
    });

    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope).toEqual({
      ok: true,
      command: "list",
      result: { items: [1, 2, 3] },
    });
  });

  test("renders full envelope as JSON on error", async () => {
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "deploy",
            handler: async () =>
              Result.err(new ValidationError({ message: "Bad input" })),
            format: "json",
          });
        } catch {
          // process.exit mock throws
        }
      });

      const envelope = JSON.parse(captured.stderr.trim());
      expect(envelope).toEqual({
        ok: false,
        command: "deploy",
        error: { category: "validation", message: "Bad input" },
      });
    } finally {
      exitMock.restore();
    }
  });
});

// =============================================================================
// Envelope Type Narrowing
// =============================================================================

describe("Envelope type narrowing", () => {
  test("success envelope has result and no error", () => {
    const envelope = createSuccessEnvelope("test", { data: 42 });

    if (envelope.ok) {
      // TypeScript should narrow to SuccessEnvelope
      expect(envelope.result).toEqual({ data: 42 });
    }
  });

  test("error envelope has error and no result", () => {
    const envelope = createErrorEnvelope("test", "not_found", "Missing");

    if (!envelope.ok) {
      // TypeScript should narrow to ErrorEnvelope
      expect(envelope.error.category).toBe("not_found");
      expect(envelope.error.message).toBe("Missing");
    }
  });
});

// =============================================================================
// runHandler() env-var mode detection
// =============================================================================

describe("runHandler() env-var mode detection", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    delete process.env["OUTFITTER_JSON"];
    delete process.env["OUTFITTER_JSONL"];
  });

  test("respects OUTFITTER_JSON=1 when format is omitted", async () => {
    process.env["OUTFITTER_JSON"] = "1";

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ status: "done" }),
        input: {},
      });
    });

    // With OUTFITTER_JSON=1 and no explicit format, output should be JSON envelope
    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe("test");
    expect(envelope.result).toEqual({ status: "done" });
  });

  test("respects OUTFITTER_JSONL=1 when format is omitted", async () => {
    process.env["OUTFITTER_JSONL"] = "1";

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ message: "hello" }),
        input: {},
      });
    });

    // With OUTFITTER_JSONL=1 and no explicit format, output should be JSON
    const envelope = JSON.parse(captured.stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.result).toEqual({ message: "hello" });
  });

  test("explicit format overrides env vars", async () => {
    process.env["OUTFITTER_JSON"] = "1";

    const captured = await captureOutput(async () => {
      await runHandler({
        command: "test",
        handler: async () => Result.ok({ status: "done" }),
        input: {},
        format: "human",
      });
    });

    // Explicit format: "human" should override OUTFITTER_JSON=1
    // Human mode writes to stdout directly, not as JSON envelope
    expect(captured.stdout).not.toContain('"ok"');
    expect(captured.stdout).toContain("done");
  });

  test("error path respects OUTFITTER_JSON=1 when format is omitted", async () => {
    process.env["OUTFITTER_JSON"] = "1";
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(async () => {
        try {
          await runHandler({
            command: "test",
            handler: async () =>
              Result.err(new ValidationError({ message: "bad input" })),
            input: {},
          });
        } catch {
          // process.exit mock throws
        }
      });

      // Error envelope should be JSON on stderr
      const envelope = JSON.parse(captured.stderr.trim());
      expect(envelope.ok).toBe(false);
      expect(envelope.error.message).toBe("bad input");
    } finally {
      exitMock.restore();
    }
  });
});

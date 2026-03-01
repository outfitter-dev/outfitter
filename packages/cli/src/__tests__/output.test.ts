/**
 * Tests for CLI output contract.
 *
 * This is the RED phase of TDD - all tests should fail with "not implemented".
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { exitWithError, output } from "../output.js";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Captures stdout/stderr output during function execution.
 */
interface CapturedOutput {
  readonly stderr: string;
  readonly stdout: string;
}

/**
 * Mock error with OutfitterError-compatible structure.
 */
interface MockKitError extends Error {
  readonly _tag: string;
  readonly category: string;
  readonly context?: Record<string, unknown>;
}

function createMockError(
  tag: string,
  category: string,
  message: string,
  context?: Record<string, unknown>
): MockKitError {
  const error = new Error(message) as MockKitError;
  Object.defineProperty(error, "_tag", { value: tag, enumerable: true });
  Object.defineProperty(error, "category", {
    value: category,
    enumerable: true,
  });
  if (context) {
    Object.defineProperty(error, "context", {
      value: context,
      enumerable: true,
    });
  }
  return error;
}

/**
 * Captures stdout and stderr during a synchronous or async function execution.
 */
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

/**
 * Mocks process.exit to capture exit codes without actually exiting.
 */
interface ExitCapture {
  readonly called: boolean;
  readonly exitCode: number | undefined;
}

function mockProcessExit(): {
  restore: () => void;
  getCapture: () => ExitCapture;
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

function setTTY(options: { stdout?: boolean; stderr?: boolean }): void {
  if (options.stdout !== undefined) {
    Object.defineProperty(process.stdout, "isTTY", {
      value: options.stdout,
      writable: true,
      configurable: true,
    });
  }

  if (options.stderr !== undefined) {
    Object.defineProperty(process.stderr, "isTTY", {
      value: options.stderr,
      writable: true,
      configurable: true,
    });
  }
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let originalEnv: NodeJS.ProcessEnv;
let originalIsTTY: boolean | undefined;
let originalStderrIsTTY: boolean | undefined;

beforeEach(() => {
  // Save original environment
  originalEnv = { ...process.env };
  originalIsTTY = process.stdout.isTTY;
  originalStderrIsTTY = process.stderr.isTTY;
});

afterEach(() => {
  // Restore original environment
  process.env = originalEnv;
  delete process.env.OUTFITTER_JSON;
  delete process.env.OUTFITTER_JSONL;
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalIsTTY,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(process.stderr, "isTTY", {
    value: originalStderrIsTTY,
    writable: true,
    configurable: true,
  });
});

// =============================================================================
// output() Mode Detection Tests
// =============================================================================

describe("output() mode detection", () => {
  test("uses human mode by default when stdout is a TTY", async () => {
    setTTY({ stdout: true });

    const captured = await captureOutput(() => {
      output({ name: "test" });
    });

    // Human mode should NOT output raw JSON
    expect(captured.stdout).not.toContain('{"name":"test"}');
  });

  test("uses human mode when stdout is not a TTY (no implicit JSON)", async () => {
    setTTY({ stdout: false });

    const captured = await captureOutput(() => {
      output({ name: "test" });
    });

    // Non-TTY defaults to human — machine output requires explicit --json
    expect(captured.stdout).not.toContain('{"name":"test"}');
    expect(captured.stdout).toContain("name");
    expect(captured.stdout).toContain("test");
  });

  test("respects explicit format argument", async () => {
    setTTY({ stdout: true });

    const captured = await captureOutput(() => {
      output({ name: "test" }, "json");
    });

    // Explicit json format should override TTY detection
    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ name: "test" });
  });

  test("respects OUTFITTER_JSON env var", async () => {
    process.env.OUTFITTER_JSON = "1";
    setTTY({ stdout: true });

    const captured = await captureOutput(() => {
      output({ name: "test" });
    });

    // Env var should override TTY detection
    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ name: "test" });
  });

  test("respects OUTFITTER_JSONL env var with priority over JSON", async () => {
    process.env.OUTFITTER_JSONL = "1";
    process.env.OUTFITTER_JSON = "1";
    setTTY({ stdout: true });

    const captured = await captureOutput(() => {
      output([{ name: "test" }]);
    });

    const lines = captured.stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({ name: "test" });
  });

  test("format argument takes precedence over env var", async () => {
    process.env.OUTFITTER_JSON = "1";
    setTTY({ stdout: false });

    const captured = await captureOutput(() => {
      output({ name: "test" }, "jsonl");
    });

    // Explicit format should override env var
    // JSONL outputs one line per item (for single object, just one JSON line)
    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ name: "test" });
  });
});

describe("output() truncation option", () => {
  test("applies truncation limit/offset before JSON serialization", async () => {
    const captured = await captureOutput(() =>
      output([1, 2, 3, 4, 5], "json", {
        truncation: { limit: 2, offset: 1 },
      })
    );

    const parsed = JSON.parse(captured.stdout.trim()) as number[];
    expect(parsed).toEqual([2, 3]);
  });

  test("does not truncate non-array data", async () => {
    const captured = await captureOutput(() =>
      output({ ok: true }, "json", {
        truncation: { limit: 1 },
      })
    );

    const parsed = JSON.parse(captured.stdout.trim()) as { ok: boolean };
    expect(parsed).toEqual({ ok: true });
  });
});

// =============================================================================
// output() JSON Mode Tests
// =============================================================================

describe("output() JSON mode", () => {
  test("outputs valid JSON for single object", async () => {
    const captured = await captureOutput(() => {
      output({ id: 1, name: "test" }, "json");
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ id: 1, name: "test" });
  });

  test("outputs valid JSON array for collections", async () => {
    const items = [
      { id: 1, name: "first" },
      { id: 2, name: "second" },
    ];

    const captured = await captureOutput(() => {
      output(items, "json");
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual(items);
  });

  test("handles undefined gracefully", async () => {
    const captured = await captureOutput(() => {
      output(undefined, "json");
    });

    // undefined should serialize to null in JSON
    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toBeNull();
  });

  test("handles null gracefully", async () => {
    const captured = await captureOutput(() => {
      output(null, "json");
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toBeNull();
  });

  test("handles circular references gracefully (safe stringify)", async () => {
    const circular: Record<string, unknown> = { name: "circular" };
    circular.self = circular;

    // Should not throw and should handle circular reference
    const captured = await captureOutput(() => {
      output(circular, "json");
    });

    // The output should be valid JSON (circular ref replaced with placeholder)
    expect(() => JSON.parse(captured.stdout.trim())).not.toThrow();
  });

  test("pretty prints when pretty option is true", async () => {
    const captured = await captureOutput(() => {
      output({ id: 1 }, "json", { pretty: true });
    });

    // Pretty printed JSON should have indentation
    expect(captured.stdout).toContain("\n");
    expect(captured.stdout).toMatch(/\s{2,}/); // At least 2-space indent
  });
});

// =============================================================================
// output() JSONL Mode Tests
// =============================================================================

describe("output() JSONL mode", () => {
  test("outputs one JSON object per line for arrays", async () => {
    const items = [
      { id: 1, name: "first" },
      { id: 2, name: "second" },
      { id: 3, name: "third" },
    ];

    const captured = await captureOutput(() => {
      output(items, "jsonl");
    });

    const lines = captured.stdout.trim().split("\n");
    expect(lines).toHaveLength(3);

    // Each line should be valid JSON
    expect(JSON.parse(lines[0])).toEqual({ id: 1, name: "first" });
    expect(JSON.parse(lines[1])).toEqual({ id: 2, name: "second" });
    expect(JSON.parse(lines[2])).toEqual({ id: 3, name: "third" });
  });

  test("single objects output as single JSON line", async () => {
    const captured = await captureOutput(() => {
      output({ id: 1, name: "single" }, "jsonl");
    });

    const lines = captured.stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({ id: 1, name: "single" });
  });

  test("each line is valid JSON", async () => {
    const items = [
      { complex: { nested: { deeply: true } } },
      { array: [1, 2, 3] },
      { unicode: "\u00e9\u00e0\u00fc" },
    ];

    const captured = await captureOutput(() => {
      output(items, "jsonl");
    });

    const lines = captured.stdout.trim().split("\n");

    // Each line must parse without error
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  test("handles empty array", async () => {
    const captured = await captureOutput(() => {
      output([], "jsonl");
    });

    // Empty array should produce no output (or empty string)
    expect(captured.stdout.trim()).toBe("");
  });
});

// =============================================================================
// output() Human Mode Tests
// =============================================================================

describe("output() human mode", () => {
  test("outputs string representation for primitives", async () => {
    const captured = await captureOutput(() => {
      output("hello world", "human");
    });

    expect(captured.stdout).toContain("hello world");
  });

  test("outputs number as string", async () => {
    const captured = await captureOutput(() => {
      output(42, "human");
    });

    expect(captured.stdout).toContain("42");
  });

  test("outputs formatted representation for objects", async () => {
    const captured = await captureOutput(() => {
      output({ name: "test", value: 123 }, "human");
    });

    // Human mode should include the object properties
    expect(captured.stdout).toContain("name");
    expect(captured.stdout).toContain("test");
  });

  test("outputs to specified stream", async () => {
    let stderrContent = "";
    const mockStderr = {
      write: (chunk: string | Uint8Array): boolean => {
        stderrContent +=
          typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
        return true;
      },
    } as NodeJS.WritableStream;

    output("error message", "human", { stream: mockStderr });

    expect(stderrContent).toContain("error message");
  });
});

// =============================================================================
// exitWithError() Error Serialization Tests (JSON mode)
// =============================================================================

describe("exitWithError() error serialization (JSON mode)", () => {
  test("includes _tag field", async () => {
    const error = createMockError(
      "ValidationError",
      "validation",
      "Invalid input"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error, "json");
        } catch {
          // Expected: process.exit mock throws
        }
      });

      const parsed = JSON.parse(
        captured.stderr.trim() || captured.stdout.trim()
      );
      expect(parsed._tag).toBe("ValidationError");
    } finally {
      exitMock.restore();
    }
  });

  test("includes category field", async () => {
    const error = createMockError(
      "NotFoundError",
      "not_found",
      "Resource not found"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error, "json");
        } catch {
          // Expected: process.exit mock throws
        }
      });

      const parsed = JSON.parse(
        captured.stderr.trim() || captured.stdout.trim()
      );
      expect(parsed.category).toBe("not_found");
    } finally {
      exitMock.restore();
    }
  });

  test("includes message field", async () => {
    const error = createMockError(
      "ValidationError",
      "validation",
      "Email is required"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error, "json");
        } catch {
          // Expected: process.exit mock throws
        }
      });

      const parsed = JSON.parse(
        captured.stderr.trim() || captured.stdout.trim()
      );
      expect(parsed.message).toBe("Email is required");
    } finally {
      exitMock.restore();
    }
  });

  test("serializes context (non-sensitive fields)", async () => {
    const error = createMockError(
      "ValidationError",
      "validation",
      "Invalid field",
      {
        field: "email",
        expected: "string",
      }
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error, "json");
        } catch {
          // Expected: process.exit mock throws
        }
      });

      const parsed = JSON.parse(
        captured.stderr.trim() || captured.stdout.trim()
      );
      expect(parsed.context).toBeDefined();
      expect(parsed.context.field).toBe("email");
      expect(parsed.context.expected).toBe("string");
    } finally {
      exitMock.restore();
    }
  });
});

// =============================================================================
// exitWithError() Exit Code Mapping Tests
// =============================================================================

describe("exitWithError() exit codes mapping", () => {
  test("exit 1 for validation errors (category: 'validation')", () => {
    const error = createMockError(
      "ValidationError",
      "validation",
      "Invalid input"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(1);
    }
  });

  test("exit 2 for not_found errors", () => {
    const error = createMockError(
      "NotFoundError",
      "not_found",
      "Resource not found"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(2);
    }
  });

  test("exit 3 for conflict errors", () => {
    const error = createMockError(
      "ConflictError",
      "conflict",
      "Version conflict"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(3);
    }
  });

  test("exit 4 for permission errors", () => {
    const error = createMockError(
      "PermissionError",
      "permission",
      "Access denied"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(4);
    }
  });

  test("exit 5 for timeout errors", () => {
    const error = createMockError(
      "TimeoutError",
      "timeout",
      "Operation timed out"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(5);
    }
  });

  test("exit 6 for rate_limit errors", () => {
    const error = createMockError(
      "RateLimitError",
      "rate_limit",
      "Rate limit exceeded"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(6);
    }
  });

  test("exit 7 for network errors", () => {
    const error = createMockError(
      "NetworkError",
      "network",
      "Connection failed"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(7);
    }
  });

  test("exit 8 for internal errors", () => {
    const error = createMockError(
      "InternalError",
      "internal",
      "Unexpected error"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(8);
    }
  });

  test("exit 9 for auth errors", () => {
    const error = createMockError("AuthError", "auth", "Authentication failed");
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(9);
    }
  });

  test("exit 130 for cancelled errors", () => {
    const error = createMockError(
      "CancelledError",
      "cancelled",
      "Operation cancelled"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(130);
    }
  });

  test("exit 1 for unknown error category (fallback)", () => {
    const error = createMockError(
      "UnknownError",
      "unknown_category",
      "Something unknown"
    );
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      // Unknown categories should fallback to exit code 1
      expect(capture.exitCode).toBe(1);
    }
  });

  test("exit 1 for plain Error without category", () => {
    const error = new Error("Plain error without category");
    const exitMock = mockProcessExit();

    try {
      exitWithError(error);
    } catch {
      // Expected: process.exit mock throws
    } finally {
      const capture = exitMock.getCapture();
      exitMock.restore();
      expect(capture.called).toBe(true);
      // Plain errors without category should default to exit code 1
      expect(capture.exitCode).toBe(1);
    }
  });
});

// =============================================================================
// exitWithError() Human Mode Tests
// =============================================================================

describe("exitWithError() human mode output", () => {
  test("writes to stderr, not stdout", async () => {
    setTTY({ stdout: true, stderr: true });

    const error = createMockError(
      "ValidationError",
      "validation",
      "Invalid input"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error);
        } catch {
          // Expected: process.exit mock throws
        }
      });

      // In human mode, error should go to stderr
      expect(captured.stderr).toContain("Invalid input");
      expect(captured.stdout).toBe("");
    } finally {
      exitMock.restore();
    }
  });

  test("includes error message", async () => {
    setTTY({ stdout: true, stderr: true });

    const error = createMockError(
      "ValidationError",
      "validation",
      "Email address is not valid"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error);
        } catch {
          // Expected: process.exit mock throws
        }
      });

      expect(captured.stderr).toContain("Email address is not valid");
    } finally {
      exitMock.restore();
    }
  });

  test("includes error tag in human-readable format", async () => {
    setTTY({ stdout: true, stderr: true });

    const error = createMockError(
      "NotFoundError",
      "not_found",
      "Resource not found"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error);
        } catch {
          // Expected: process.exit mock throws
        }
      });

      // Human mode should include some indication of error type
      expect(
        captured.stderr.includes("NotFoundError") ||
          captured.stderr.includes("not found")
      ).toBe(true);
    } finally {
      exitMock.restore();
    }
  });
});

// =============================================================================
// output() format parameter tests (OS-331)
// =============================================================================

describe("output() format parameter", () => {
  test("accepts format as second argument", async () => {
    const captured = await captureOutput(() => {
      output({ name: "test" }, "json");
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ name: "test" });
  });

  test("format parameter takes precedence over env vars", async () => {
    process.env.OUTFITTER_JSON = "1";

    const captured = await captureOutput(() => {
      output({ name: "test" }, "human");
    });

    // Explicit "human" format should override OUTFITTER_JSON=1
    expect(captured.stdout).not.toContain('{"name":"test"}');
    expect(captured.stdout).toContain("name");
    expect(captured.stdout).toContain("test");
  });

  test("format 'json' produces JSON output", async () => {
    const captured = await captureOutput(() => {
      output({ id: 1, value: "hello" }, "json");
    });

    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ id: 1, value: "hello" });
  });

  test("format 'jsonl' produces JSONL output for arrays", async () => {
    const items = [{ a: 1 }, { b: 2 }];

    const captured = await captureOutput(() => {
      output(items, "jsonl");
    });

    const lines = captured.stdout.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ a: 1 });
    expect(JSON.parse(lines[1])).toEqual({ b: 2 });
  });

  test("format 'human' produces human-readable output", async () => {
    const captured = await captureOutput(() => {
      output("hello world", "human");
    });

    expect(captured.stdout).toContain("hello world");
  });

  test("when format is undefined, falls back to env var detection", async () => {
    process.env.OUTFITTER_JSON = "1";

    const captured = await captureOutput(() => {
      output({ name: "test" }, undefined);
    });

    // Should pick up OUTFITTER_JSON=1
    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ name: "test" });
  });

  test("when format is undefined and no env, defaults to human", async () => {
    delete process.env.OUTFITTER_JSON;
    delete process.env.OUTFITTER_JSONL;

    const captured = await captureOutput(() => {
      output({ name: "test" }, undefined);
    });

    expect(captured.stdout).not.toContain('{"name":"test"}');
    expect(captured.stdout).toContain("name");
    expect(captured.stdout).toContain("test");
  });

  test("format works with options (pretty print)", async () => {
    const captured = await captureOutput(() => {
      output({ id: 1 }, "json", { pretty: true });
    });

    // Pretty printed JSON should have indentation
    expect(captured.stdout).toContain("\n");
    expect(captured.stdout).toMatch(/\s{2,}/);
    const parsed = JSON.parse(captured.stdout.trim());
    expect(parsed).toEqual({ id: 1 });
  });

  test("format works with custom stream option", async () => {
    let stderrContent = "";
    const mockStderr = {
      write: (chunk: string | Uint8Array): boolean => {
        stderrContent +=
          typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
        return true;
      },
    } as NodeJS.WritableStream;

    output("error info", "human", { stream: mockStderr });

    expect(stderrContent).toContain("error info");
  });

  test("hierarchy: format > env > default", async () => {
    // Set both env vars
    process.env.OUTFITTER_JSON = "1";
    process.env.OUTFITTER_JSONL = "1";

    // Explicit human format should override both env vars
    const captured = await captureOutput(() => {
      output({ name: "test" }, "human");
    });

    expect(captured.stdout).not.toContain('{"name":"test"}');
    expect(captured.stdout).toContain("name");
  });
});

// =============================================================================
// exitWithError() format parameter tests (OS-331)
// =============================================================================

describe("exitWithError() format parameter", () => {
  test("accepts format as second argument for JSON mode", async () => {
    const error = createMockError(
      "ValidationError",
      "validation",
      "Invalid input"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error, "json");
        } catch {
          // Expected: process.exit mock throws
        }
      });

      const parsed = JSON.parse(
        captured.stderr.trim() || captured.stdout.trim()
      );
      expect(parsed.message).toBe("Invalid input");
      expect(parsed._tag).toBe("ValidationError");
    } finally {
      exitMock.restore();
    }
  });

  test("format 'human' produces human-readable error", async () => {
    const error = createMockError(
      "NotFoundError",
      "not_found",
      "Resource not found"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error, "human");
        } catch {
          // Expected: process.exit mock throws
        }
      });

      expect(captured.stderr).toContain("NotFoundError");
      expect(captured.stderr).toContain("Resource not found");
    } finally {
      exitMock.restore();
    }
  });

  test("format with exit code mapping", async () => {
    const error = createMockError(
      "ValidationError",
      "validation",
      "Bad request"
    );
    const exitMock = mockProcessExit();

    try {
      const captured = await captureOutput(() => {
        try {
          exitWithError(error, "json");
        } catch {
          // Expected: process.exit mock throws
        }
      });

      const parsed = JSON.parse(captured.stderr.trim());
      expect(parsed.message).toBe("Bad request");
      expect(parsed._tag).toBe("ValidationError");

      const capture = exitMock.getCapture();
      expect(capture.called).toBe(true);
      expect(capture.exitCode).toBe(1);
    } finally {
      exitMock.restore();
    }
  });
});

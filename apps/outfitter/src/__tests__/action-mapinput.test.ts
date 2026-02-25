/**
 * Tests for action mapInput functions — flag presets, deprecated aliases,
 * and env var fallbacks.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { outfitterActions } from "../actions.js";

async function withArgv(
  argv: readonly string[],
  run: () => void | Promise<void>
): Promise<void> {
  const originalArgv = process.argv;
  process.argv = [...argv];
  try {
    await run();
  } finally {
    process.argv = originalArgv;
  }
}

// ---------------------------------------------------------------------------
// check mapInput
// ---------------------------------------------------------------------------

describe("check mapInput", () => {
  test("--all maps to orchestrator mode all", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { all: true },
    }) as { mode: string };

    expect(mapped.mode).toBe("all");
  });

  test("--ci maps to orchestrator mode ci", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { ci: true },
    }) as { mode: string };

    expect(mapped.mode).toBe("ci");
  });

  test("--pre-commit maps to orchestrator mode pre-commit", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { preCommit: true },
    }) as { mode: string };

    expect(mapped.mode).toBe("pre-commit");
  });

  test("--pre-push maps to orchestrator mode pre-push", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { prePush: true },
    }) as { mode: string };

    expect(mapped.mode).toBe("pre-push");
  });

  test("--pre-commit captures staged files from args", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: ["apps/outfitter/src/cli.ts", ".claude/hooks/pre-commit.sh"],
      flags: { preCommit: true },
    }) as { stagedFiles?: readonly string[] };

    expect(mapped.stagedFiles).toEqual([
      "apps/outfitter/src/cli.ts",
      ".claude/hooks/pre-commit.sh",
    ]);
  });

  test("mode flags are mutually exclusive", () => {
    const action = outfitterActions.get("check");
    expect(() =>
      action?.cli?.mapInput?.({
        args: [],
        flags: { all: true, ci: true },
      })
    ).toThrow("Use only one of --all, --ci, --pre-commit, or --pre-push.");
  });

  test("--block cannot be combined with orchestrator mode flags", () => {
    const action = outfitterActions.get("check");
    expect(() =>
      action?.cli?.mapInput?.({
        args: [],
        flags: { block: "linter", ci: true },
      })
    ).toThrow("--block cannot be combined with orchestrator mode flags.");
  });

  test("--output json maps to outputMode json", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("--compact maps to compact true", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { compact: true },
    }) as { compact: boolean };

    expect(mapped.compact).toBe(true);
  });

  test("compact defaults to false", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { compact: boolean };

    expect(mapped.compact).toBe(false);
  });

  test("--output json takes precedence over mode defaults", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json", ci: true },
    }) as { outputMode: string; mode: string };

    expect(mapped.outputMode).toBe("json");
    expect(mapped.mode).toBe("ci");
  });

  describe("OUTFITTER_JSON env var", () => {
    let previous: string | undefined;

    beforeEach(() => {
      previous = process.env["OUTFITTER_JSON"];
    });

    afterEach(() => {
      if (previous === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = previous;
      }
    });

    test("OUTFITTER_JSON=1 maps to outputMode json when no flags", () => {
      process.env["OUTFITTER_JSON"] = "1";
      const action = outfitterActions.get("check");
      const mapped = action?.cli?.mapInput?.({
        args: [],
        flags: {},
      }) as { outputMode: string };

      expect(mapped.outputMode).toBe("json");
    });

    test("explicit --output human overrides OUTFITTER_JSON=1", () => {
      process.env["OUTFITTER_JSON"] = "1";
      return withArgv(
        ["bun", "outfitter", "check", "--output", "human"],
        () => {
          const action = outfitterActions.get("check");
          const mapped = action?.cli?.mapInput?.({
            args: [],
            flags: { output: "human" },
          }) as { outputMode: string };

          expect(mapped.outputMode).toBe("human");
        }
      );
    });

    test("explicit --output human overrides OUTFITTER_JSONL=1", () => {
      const previousJsonl = process.env["OUTFITTER_JSONL"];
      process.env["OUTFITTER_JSONL"] = "1";
      try {
        return withArgv(
          ["bun", "outfitter", "check", "--output", "human"],
          () => {
            const action = outfitterActions.get("check");
            const mapped = action?.cli?.mapInput?.({
              args: [],
              flags: { output: "human" },
            }) as { outputMode: string };

            expect(mapped.outputMode).toBe("human");
          }
        );
      } finally {
        if (previousJsonl === undefined) {
          delete process.env["OUTFITTER_JSONL"];
        } else {
          process.env["OUTFITTER_JSONL"] = previousJsonl;
        }
      }
    });

    test("mode flag suppresses OUTFITTER_JSON=1 fallback", () => {
      process.env["OUTFITTER_JSON"] = "1";
      const action = outfitterActions.get("check");
      const mapped = action?.cli?.mapInput?.({
        args: [],
        flags: { all: true },
      }) as { outputMode: string; mode: string };

      expect(mapped.mode).toBe("all");
      expect(mapped.outputMode).toBe("human");
    });
  });

  test("--cwd maps to resolved cwd", () => {
    const action = outfitterActions.get("check");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });
});

// ---------------------------------------------------------------------------
// doctor mapInput
// ---------------------------------------------------------------------------

describe("doctor mapInput", () => {
  test("--cwd maps to resolved cwd", () => {
    const action = outfitterActions.get("doctor");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("defaults cwd to process.cwd() when --cwd omitted", () => {
    const action = outfitterActions.get("doctor");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });
});

// ---------------------------------------------------------------------------
// add mapInput
// ---------------------------------------------------------------------------

describe("add mapInput", () => {
  test("--cwd maps to resolved cwd", () => {
    const action = outfitterActions.get("add");
    const mapped = action?.cli?.mapInput?.({
      args: ["linter"],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string; block: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
    expect(mapped.block).toBe("linter");
  });

  test("defaults cwd to process.cwd() when --cwd omitted", () => {
    const action = outfitterActions.get("add");
    const mapped = action?.cli?.mapInput?.({
      args: ["linter"],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });
});

// ---------------------------------------------------------------------------
// check.tsdoc mapInput
// ---------------------------------------------------------------------------

describe("check.tsdoc mapInput", () => {
  test("explicit --output human overrides OUTFITTER_JSON=1", () => {
    const previousJson = process.env["OUTFITTER_JSON"];
    process.env["OUTFITTER_JSON"] = "1";

    try {
      return withArgv(
        ["bun", "outfitter", "check", "tsdoc", "--output", "human"],
        () => {
          const action = outfitterActions.get("check.tsdoc");
          const mapped = action?.cli?.mapInput?.({
            args: [],
            flags: { output: "human" },
          }) as { outputMode: string };

          expect(mapped.outputMode).toBe("human");
        }
      );
    } finally {
      if (previousJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = previousJson;
      }
    }
  });

  test("explicit --output human overrides OUTFITTER_JSONL=1", () => {
    const previousJsonl = process.env["OUTFITTER_JSONL"];
    process.env["OUTFITTER_JSONL"] = "1";

    try {
      return withArgv(
        ["bun", "outfitter", "check", "tsdoc", "--output", "human"],
        () => {
          const action = outfitterActions.get("check.tsdoc");
          const mapped = action?.cli?.mapInput?.({
            args: [],
            flags: { output: "human" },
          }) as { outputMode: string };

          expect(mapped.outputMode).toBe("human");
        }
      );
    } finally {
      if (previousJsonl === undefined) {
        delete process.env["OUTFITTER_JSONL"];
      } else {
        process.env["OUTFITTER_JSONL"] = previousJsonl;
      }
    }
  });
});

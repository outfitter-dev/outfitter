/**
 * Tests for `docs.export` action -- registration, mapInput, and handler.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { outfitterActions } from "../actions.js";
import { runDocsExport } from "../commands/docs-export.js";

describe("docs.export action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("docs.export");
    expect(action).toBeDefined();
    expect(action?.id).toBe("docs.export");
    expect(action?.description).toBeDefined();
    expect(action?.surfaces).toContain("cli");
  });

  test("has CLI group 'docs' and command 'export'", () => {
    const action = outfitterActions.get("docs.export");
    expect(action?.cli?.group).toBe("docs");
    expect(action?.cli?.command).toBe("export");
  });

  test("mapInput resolves cwd from --cwd flag", () => {
    const action = outfitterActions.get("docs.export");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("mapInput defaults cwd to process.cwd() when omitted", () => {
    const action = outfitterActions.get("docs.export");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });

  test("mapInput resolves --target flag with default 'all'", () => {
    const action = outfitterActions.get("docs.export");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { target: string };

    expect(mapped.target).toBe("all");
  });

  test("mapInput resolves --target flag to specified value", () => {
    const action = outfitterActions.get("docs.export");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { target: "llms" },
    }) as { target: string };

    expect(mapped.target).toBe("llms");
  });

  test("mapInput preserves unknown --target values for schema validation", () => {
    const action = outfitterActions.get("docs.export");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { target: "lms" },
    }) as { target: string };

    expect(mapped.target).toBe("lms");
  });

  test("mapInput resolves output mode from flags", () => {
    const action = outfitterActions.get("docs.export");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });
});

describe("runDocsExport", () => {
  test("captures non-fatal warnings emitted on stderr", async () => {
    const result = await runDocsExport(
      {
        cwd: "/tmp/workspace",
        target: "all",
        outputMode: "human",
      },
      {
        loadDocsModule: async () => ({
          executeExportCommand: async (_options, io) => {
            io.out("Exported docs");
            io.err("Warning: skipped malformed file");
            return 0;
          },
        }),
      }
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      throw new Error(result.error.message);
    }

    expect(result.value.messages).toEqual(["Exported docs"]);
    expect(result.value.warnings).toEqual(["Warning: skipped malformed file"]);
  });

  test("uses captured stderr content when export fails", async () => {
    const result = await runDocsExport(
      {
        cwd: "/tmp/workspace",
        target: "all",
        outputMode: "human",
      },
      {
        loadDocsModule: async () => ({
          executeExportCommand: async (_options, io) => {
            io.err("fatal: export failed");
            return 1;
          },
        }),
      }
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected runDocsExport to fail");
    }

    expect(result.error.message).toContain("fatal: export failed");
  });

  test("returns internal error when loader throws", async () => {
    const result = await runDocsExport(
      {
        cwd: "/tmp/workspace",
        target: "all",
        outputMode: "human",
      },
      {
        loadDocsModule: async () => {
          return Promise.reject(new Error("load failed"));
        },
      }
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected runDocsExport to fail");
    }
    expect(result.error.message).toContain("load failed");
  });
});

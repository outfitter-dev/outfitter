/**
 * Tests for `docs.api` action — registration, mapInput, and handler.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { InternalError, Result, ValidationError } from "@outfitter/contracts";
import type { TsDocCheckResult } from "@outfitter/tooling";
import { outfitterActions } from "../actions.js";
import { runDocsApi } from "../commands/docs-api.js";

describe("docs.api action", () => {
  test("is registered in the action registry", () => {
    const action = outfitterActions.get("docs.api");
    expect(action).toBeDefined();
    expect(action?.id).toBe("docs.api");
    expect(action?.description).toBeDefined();
    expect(action?.surfaces).toContain("cli");
  });

  test("has CLI group 'docs' and command 'api'", () => {
    const action = outfitterActions.get("docs.api");
    expect(action?.cli?.group).toBe("docs");
    expect(action?.cli?.command).toBe("api");
  });

  test("mapInput resolves cwd from --cwd flag", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { cwd: "/tmp/test-project" },
    }) as { cwd: string };

    expect(mapped.cwd).toBe("/tmp/test-project");
  });

  test("mapInput defaults cwd to process.cwd() when omitted", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { cwd: string };

    expect(mapped.cwd).toBe(process.cwd());
  });

  test("mapInput resolves --level filter flag", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { level: "documented" },
    }) as { level: string | undefined };

    expect(mapped.level).toBe("documented");
  });

  test("mapInput ignores invalid --level values", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { level: "invalid" },
    }) as { level: string | undefined };

    expect(mapped.level).toBeUndefined();
  });

  test("mapInput resolves --package flag as array", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { package: ["cli", "contracts"] },
    }) as { packages: string[] };

    expect(mapped.packages).toEqual(["cli", "contracts"]);
  });

  test("mapInput resolves single --package flag as array", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { package: "cli" },
    }) as { packages: string[] };

    expect(mapped.packages).toEqual(["cli"]);
  });

  test("mapInput defaults packages to empty array", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: {},
    }) as { packages: string[] };

    expect(mapped.packages).toEqual([]);
  });

  test("mapInput resolves output mode from flags", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json" },
    }) as { outputMode: string };

    expect(mapped.outputMode).toBe("json");
  });

  test("mapInput resolves --jq expression", () => {
    const action = outfitterActions.get("docs.api");
    const mapped = action?.cli?.mapInput?.({
      args: [],
      flags: { output: "json", jq: ".packages[0]" },
    }) as { jq: string | undefined };

    expect(mapped.jq).toBe(".packages[0]");
  });
});

describe("runDocsApi", () => {
  const sampleResult: TsDocCheckResult = {
    ok: true,
    summary: {
      documented: 1,
      partial: 0,
      percentage: 100,
      total: 1,
      undocumented: 0,
    },
    packages: [
      {
        name: "@outfitter/cli",
        path: "/tmp/workspace/packages/cli",
        documented: 1,
        partial: 0,
        undocumented: 0,
        total: 1,
        percentage: 100,
        declarations: [
          {
            file: "/tmp/workspace/packages/cli/src/index.ts",
            kind: "function",
            level: "documented",
            line: 1,
            name: "example",
          },
        ],
      },
    ],
  };

  test("delegates to runCheckTsdoc with output emission disabled", async () => {
    let capturedInput:
      | {
          emitOutput?: boolean;
          minCoverage: number;
          strict: boolean;
          summary: boolean;
        }
      | undefined;

    const result = await runDocsApi(
      {
        cwd: "/tmp/workspace",
        jq: undefined,
        level: undefined,
        outputMode: "human",
        packages: [],
      },
      {
        runCheckTsdoc: async (input) => {
          capturedInput = {
            emitOutput: input.emitOutput,
            minCoverage: input.minCoverage,
            strict: input.strict,
            summary: input.summary,
          };
          return Result.ok(sampleResult);
        },
      }
    );

    expect(result.isOk()).toBe(true);
    expect(capturedInput).toEqual({
      emitOutput: false,
      minCoverage: 0,
      strict: false,
      summary: false,
    });
  });

  test("preserves ValidationError from runCheckTsdoc", async () => {
    const validationError = ValidationError.fromMessage("No packages found");
    const result = await runDocsApi(
      {
        cwd: "/tmp/workspace",
        jq: undefined,
        level: undefined,
        outputMode: "human",
        packages: [],
      },
      {
        runCheckTsdoc: async () => Result.err(validationError),
      }
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected runDocsApi to return an error");
    }
    expect(result.error).toBe(validationError);
  });

  test("preserves InternalError from runCheckTsdoc", async () => {
    const internalError = new InternalError({
      message: "tooling exploded",
      context: { action: "check.tsdoc" },
    });
    const result = await runDocsApi(
      {
        cwd: "/tmp/workspace",
        jq: undefined,
        level: undefined,
        outputMode: "human",
        packages: [],
      },
      {
        runCheckTsdoc: async () => Result.err(internalError),
      }
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected runDocsApi to return an error");
    }
    expect(result.error).toBe(internalError);
  });
});

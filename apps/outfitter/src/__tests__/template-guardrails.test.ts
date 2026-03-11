import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findMissingExportedSchemaAnnotations,
  runTemplateGuardrails,
} from "../scaffold-e2e/template-guardrails.js";

describe("scaffold template guardrails", () => {
  test("checks compound-extension scaffold artifacts", async () => {
    const repoRoot = join(import.meta.dir, "..", "..", "..", "..");
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "outfitter-template-guardrails-")
    );

    try {
      symlinkSync(
        join(repoRoot, "node_modules"),
        join(workspaceRoot, "node_modules")
      );
      mkdirSync(
        join(workspaceRoot, "packages", "presets", "presets", "minimal", "src"),
        { recursive: true }
      );
      writeFileSync(
        join(
          workspaceRoot,
          "packages",
          "presets",
          "presets",
          "minimal",
          "src",
          "index.test.ts.template"
        ),
        "export   const value=1;\n"
      );

      const result = await runTemplateGuardrails({
        workspaceRoot,
      });

      expect(result.ok).toBe(false);
      expect(
        result.failures.some((failure) =>
          failure.paths.some((path) => path.endsWith("index.test.ts"))
        )
      ).toBe(true);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  test("flags exported Zod schemas that are missing explicit type annotations", () => {
    const result = findMissingExportedSchemaAnnotations([
      {
        path: "src/types.ts.template",
        content: [
          'import { z } from "zod";',
          "",
          "export const greetingInputSchema = z.object({",
          "  name: z.string(),",
          "});",
        ].join("\n"),
      },
    ]);

    expect(result).toEqual([
      {
        path: "src/types.ts.template",
        line: 3,
        source: "export const greetingInputSchema = z.object({",
      },
    ]);
  });

  test("ignores exported Zod schemas that already declare their type", () => {
    const result = findMissingExportedSchemaAnnotations([
      {
        path: "src/types.ts.template",
        content: [
          'import { type ZodType, z } from "zod";',
          "",
          "export const greetingInputSchema: ZodType<GreetingInput> = z.object({",
          "  name: z.string(),",
          "});",
        ].join("\n"),
      },
    ]);

    expect(result).toEqual([]);
  });

  test("passes formatting and lint checks for shipped scaffold artifacts", async () => {
    const workspaceRoot = join(import.meta.dir, "..", "..", "..", "..");

    const result = await runTemplateGuardrails({
      workspaceRoot,
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });
});

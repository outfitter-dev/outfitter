import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  findMissingExportedSchemaAnnotations,
  runTemplateGuardrails,
} from "../scaffold-e2e/template-guardrails.js";

describe("scaffold template guardrails", () => {
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

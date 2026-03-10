import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { runTemplateGuardrails } from "../scaffold-e2e/template-guardrails.js";

describe("scaffold template guardrails", () => {
  test("passes formatting and lint checks for shipped scaffold artifacts", async () => {
    const workspaceRoot = join(import.meta.dir, "..", "..", "..", "..");

    const result = await runTemplateGuardrails({
      workspaceRoot,
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });
});

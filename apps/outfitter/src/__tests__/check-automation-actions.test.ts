import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { outfitterActions } from "../actions.js";

const CHECK_AUTOMATION_ACTIONS = [
  {
    id: "check.publish-guardrails",
    command: "publish-guardrails",
  },
  {
    id: "check.preset-versions",
    command: "preset-versions",
  },
  {
    id: "check.surface-map",
    command: "surface-map",
  },
  {
    id: "check.surface-map-format",
    command: "surface-map-format",
  },
  {
    id: "check.docs-sentinel",
    command: "docs-sentinel",
  },
  {
    id: "check.action-ceremony",
    command: "action-ceremony",
  },
] as const;

describe("check automation action registration", () => {
  for (const entry of CHECK_AUTOMATION_ACTIONS) {
    test(`${entry.id} is registered under check group`, () => {
      const action = outfitterActions.get(entry.id);

      expect(action).toBeDefined();
      expect(action?.cli?.group).toBe("check");
      expect(action?.cli?.command).toBe(entry.command);
      expect(action?.surfaces).toEqual(["cli"]);
    });
  }
});

const workspaceRoot = resolve(import.meta.dir, "../../../..");

function mergeEnv(
  overrides: Record<string, string | undefined>
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string") {
      env[key] = value;
    } else {
      delete env[key];
    }
  }

  return env;
}

async function runOutfitterCheck(
  args: readonly string[],
  envOverrides: Record<string, string | undefined>
): Promise<{ code: number; stderr: string; stdout: string }> {
  const child = Bun.spawn(
    ["bun", "run", "apps/outfitter/src/cli.ts", ...args],
    {
      cwd: workspaceRoot,
      env: mergeEnv(envOverrides),
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    }
  );

  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { code, stderr, stdout };
}

describe("check automation CLI output mode", () => {
  test("OUTFITTER_JSON=1 falls back to json output", async () => {
    const result = await runOutfitterCheck(
      ["check", "publish-guardrails", "--cwd", "."],
      {
        OUTFITTER_JSON: "1",
        OUTFITTER_JSONL: undefined,
      }
    );

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as {
      checkedManifestCount: number;
      ok: boolean;
      violations: unknown[];
    };

    expect(payload.ok).toBe(true);
    expect(payload.checkedManifestCount).toBeGreaterThan(0);
    expect(payload.violations).toEqual([]);
  });

  test("explicit --output human overrides OUTFITTER_JSON=1", async () => {
    const result = await runOutfitterCheck(
      ["check", "publish-guardrails", "--cwd", ".", "--output", "human"],
      {
        OUTFITTER_JSON: "1",
        OUTFITTER_JSONL: undefined,
      }
    );

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(
      /\[publish-guardrails\] checked \d+ workspace manifests; all publishable packages enforce prepublishOnly guard/
    );
    expect(() => JSON.parse(result.stdout)).toThrow();
  });

  test("OUTFITTER_JSONL=1 falls back to jsonl output", async () => {
    const result = await runOutfitterCheck(
      ["check", "publish-guardrails", "--cwd", "."],
      {
        OUTFITTER_JSON: undefined,
        OUTFITTER_JSONL: "1",
      }
    );

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");

    // JSONL framing: single non-empty line (no pretty-printed JSON)
    const lines = result.stdout.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);

    const payload = JSON.parse(lines[0]!) as {
      ok: boolean;
      violations: unknown[];
      workspaceRoot: string;
    };

    expect(payload.ok).toBe(true);
    expect(payload.workspaceRoot).toBe(workspaceRoot);
    expect(payload.violations).toEqual([]);
  });
});

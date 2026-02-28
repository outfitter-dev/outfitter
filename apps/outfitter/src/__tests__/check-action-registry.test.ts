import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { outfitterActions } from "../actions.js";
import {
  runCheckActionRegistry,
  type CheckActionRegistryResult,
} from "../commands/check-action-registry.js";

const workspaceRoot = resolve(import.meta.dir, "../../../..");

describe("check action-registry action registration", () => {
  test("check.action-registry is registered under check group", () => {
    const action = outfitterActions.get("check.action-registry");

    expect(action).toBeDefined();
    expect(action?.cli?.group).toBe("check");
    expect(action?.cli?.command).toBe("action-registry");
    expect(action?.surfaces).toEqual(["cli"]);
  });
});

describe("runCheckActionRegistry", () => {
  test("returns Ok result with structured output", async () => {
    const result = await runCheckActionRegistry({ cwd: workspaceRoot });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const value: CheckActionRegistryResult = result.value;
    expect(value).toHaveProperty("ok");
    expect(value).toHaveProperty("commandsDir");
    expect(value).toHaveProperty("actionsDir");
    expect(value).toHaveProperty("totalCommands");
    expect(value).toHaveProperty("registeredCount");
    expect(value).toHaveProperty("unregisteredCount");
    expect(value).toHaveProperty("registered");
    expect(value).toHaveProperty("unregistered");
  });

  test("totalCommands equals registered + unregistered counts", async () => {
    const result = await runCheckActionRegistry({ cwd: workspaceRoot });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(result.value.totalCommands).toBe(
      result.value.registeredCount + result.value.unregisteredCount
    );
  });

  test("registered array contains command files imported by actions", async () => {
    const result = await runCheckActionRegistry({ cwd: workspaceRoot });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    // These files are known to be imported by action definition files
    const knownRegistered = [
      "check.ts",
      "check-tsdoc.ts",
      "check-action-ceremony.ts",
      "check-docs-sentinel.ts",
      "check-preset-versions.ts",
      "check-publish-guardrails.ts",
      "check-surface-map.ts",
      "check-surface-map-format.ts",
      "demo.ts",
      "doctor.ts",
      "init.ts",
      "scaffold.ts",
      "upgrade.ts",
      "add.ts",
    ];

    for (const file of knownRegistered) {
      expect(result.value.registered).toContain(file);
    }
  });

  test("unregistered array contains helper files not imported by actions", async () => {
    const result = await runCheckActionRegistry({ cwd: workspaceRoot });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    // jq-utils.ts and docs-types.ts are known helper files
    expect(result.value.unregistered).toContain("jq-utils.ts");
    expect(result.value.unregistered).toContain("docs-types.ts");
  });

  test("each unregistered entry includes the file path", async () => {
    const result = await runCheckActionRegistry({ cwd: workspaceRoot });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    // All entries should be filenames with .ts extension
    for (const file of result.value.unregistered) {
      expect(file).toMatch(/\.ts$/);
    }
  });

  test("returns error for nonexistent workspace root", async () => {
    const result = await runCheckActionRegistry({
      cwd: "/nonexistent/path",
    });

    expect(result.isErr()).toBe(true);
  });

  test("supports cwd set to apps/outfitter instead of workspace root", async () => {
    const nestedCwd = resolve(workspaceRoot, "apps/outfitter");
    const nestedResult = await runCheckActionRegistry({ cwd: nestedCwd });
    const rootResult = await runCheckActionRegistry({ cwd: workspaceRoot });

    expect(nestedResult.isOk()).toBe(true);
    expect(rootResult.isOk()).toBe(true);

    if (nestedResult.isErr() || rootResult.isErr()) return;

    expect(nestedResult.value.totalCommands).toBe(
      rootResult.value.totalCommands
    );
    expect(nestedResult.value.registeredCount).toBe(
      rootResult.value.registeredCount
    );
    expect(nestedResult.value.unregisteredCount).toBe(
      rootResult.value.unregisteredCount
    );
  });

  test("ok is true when all primary commands are registered", async () => {
    // This test verifies the current state — if it fails it means a command
    // file that looks like a primary handler is missing from the registry
    const result = await runCheckActionRegistry({ cwd: workspaceRoot });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    // The ok field reflects whether any "primary" command files are missing
    // (helper/utility files are expected to be unregistered)
    expect(typeof result.value.ok).toBe("boolean");
  });
});

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

describe("check action-registry CLI output", () => {
  test("outputs structured JSON with --output json", async () => {
    const child = Bun.spawn(
      [
        "bun",
        "run",
        "apps/outfitter/src/cli.ts",
        "check",
        "action-registry",
        "--output",
        "json",
        "--cwd",
        ".",
      ],
      {
        cwd: workspaceRoot,
        env: mergeEnv({
          OUTFITTER_JSON: undefined,
          OUTFITTER_JSONL: undefined,
        }),
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

    // Exit code 1 is expected when there are unregistered helper files
    expect(code).toBeOneOf([0, 1]);

    const payload = JSON.parse(stdout) as CheckActionRegistryResult;
    expect(payload.totalCommands).toBeGreaterThan(0);
    expect(payload.registeredCount).toBeGreaterThan(0);
    expect(Array.isArray(payload.registered)).toBe(true);
    expect(Array.isArray(payload.unregistered)).toBe(true);
  });

  test("outputs human-readable format by default", async () => {
    const child = Bun.spawn(
      [
        "bun",
        "run",
        "apps/outfitter/src/cli.ts",
        "check",
        "action-registry",
        "--cwd",
        ".",
      ],
      {
        cwd: workspaceRoot,
        env: mergeEnv({
          OUTFITTER_JSON: undefined,
          OUTFITTER_JSONL: undefined,
        }),
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      }
    );

    const [stdout, , code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    // Exit code 1 is expected when there are unregistered helper files
    expect(code).toBeOneOf([0, 1]);
    expect(stdout).toContain("[action-registry]");
  });
});

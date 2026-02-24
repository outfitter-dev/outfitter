import { describe, expect, spyOn, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type CheckTsDocInput,
  runCheckTsdoc,
} from "../commands/check-tsdoc.js";

function createWorkspace(source: string): { cwd: string; packageName: string } {
  const cwd = mkdtempSync(join(tmpdir(), "outfitter-check-tsdoc-"));
  const packageName = "@demo/pkg";
  const pkgRoot = join(cwd, "packages", "demo");

  mkdirSync(join(pkgRoot, "src"), { recursive: true });
  writeFileSync(
    join(pkgRoot, "package.json"),
    JSON.stringify({ name: packageName, version: "0.0.0" }, null, 2)
  );
  writeFileSync(join(pkgRoot, "src", "index.ts"), source);

  return { cwd, packageName };
}

function createConfiguredWorkspace(options: {
  readonly memberDir: string;
  readonly packageName: string;
  readonly source: string;
  readonly packageJsonEntrypoints?: readonly string[];
  readonly configEntrypoints?: readonly string[];
}): { cwd: string; packageName: string } {
  const cwd = mkdtempSync(join(tmpdir(), "outfitter-check-tsdoc-"));
  const pkgRoot = join(cwd, options.memberDir);

  mkdirSync(join(pkgRoot, "src"), { recursive: true });
  writeFileSync(
    join(pkgRoot, "package.json"),
    JSON.stringify({ name: options.packageName, version: "0.0.0" }, null, 2)
  );
  writeFileSync(join(pkgRoot, "src", "index.ts"), options.source);

  // When memberDir is ".", the member package.json IS the root package.json,
  // so skip writing a separate root to avoid overwriting the member's name.
  if (options.memberDir !== ".") {
    const rootPackageJson = {
      name: "workspace-root",
      version: "0.0.0",
      ...(options.packageJsonEntrypoints
        ? {
            outfitter: {
              tsdoc: {
                entrypoints: options.packageJsonEntrypoints,
              },
            },
          }
        : {}),
    };
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify(rootPackageJson, null, 2)
    );
  } else if (options.packageJsonEntrypoints) {
    // Merge entrypoints config into the member's root package.json
    const existing = JSON.parse(
      readFileSync(join(cwd, "package.json"), "utf-8")
    );
    existing.outfitter = {
      tsdoc: { entrypoints: options.packageJsonEntrypoints },
    };
    writeFileSync(join(cwd, "package.json"), JSON.stringify(existing, null, 2));
  }

  if (options.configEntrypoints) {
    mkdirSync(join(cwd, ".outfitter"), { recursive: true });
    writeFileSync(
      join(cwd, ".outfitter", "config.json"),
      JSON.stringify(
        {
          tsdoc: {
            entrypoints: options.configEntrypoints,
          },
        },
        null,
        2
      )
    );
  }

  return { cwd, packageName: options.packageName };
}

function createInput(
  cwd: string,
  overrides: Partial<CheckTsDocInput> = {}
): CheckTsDocInput {
  return {
    strict: false,
    minCoverage: 0,
    cwd,
    outputMode: "json",
    jq: undefined,
    summary: false,
    level: undefined,
    packages: [],
    ...overrides,
  };
}

async function runWithCapturedOutput(input: CheckTsDocInput): Promise<{
  result: Awaited<ReturnType<typeof runCheckTsdoc>>;
  stdout: string;
  stderr: string;
}> {
  let stdout = "";
  let stderr = "";

  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  const captureStdout = ((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;

  const captureStderr = ((chunk: unknown) => {
    stderr += String(chunk);
    return true;
  }) as typeof process.stderr.write;

  Object.assign(process.stdout, { write: captureStdout });
  Object.assign(process.stderr, { write: captureStderr });

  try {
    const result = await runCheckTsdoc(input);
    return { result, stdout, stderr };
  } finally {
    Object.assign(process.stdout, { write: originalStdoutWrite });
    Object.assign(process.stderr, { write: originalStderrWrite });
  }
}

describe("runCheckTsdoc", () => {
  test("respects input cwd and analyzes that workspace", async () => {
    const workspace = createWorkspace(
      "/** Doc. */\nexport function alpha() {}"
    );

    try {
      const { result } = await runWithCapturedOutput(
        createInput(workspace.cwd)
      );
      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      expect(result.value.packages).toHaveLength(1);
      expect(result.value.packages[0]?.name).toBe(workspace.packageName);
    } finally {
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });

  test("keeps partial-doc weighting when filters are applied", async () => {
    const workspace = createWorkspace(
      [
        "/** Fully documented function. */",
        "export function documented(): void {}",
        "",
        "/** Shape contract. */",
        "export interface Shape {",
        "  /** Width in px. */",
        "  width: number;",
        "  height: number;",
        "}",
      ].join("\n")
    );

    try {
      const { result } = await runWithCapturedOutput(
        createInput(workspace.cwd, {
          packages: [workspace.packageName],
        })
      );
      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      expect(result.value.summary.percentage).toBe(75);
      expect(result.value.packages[0]?.percentage).toBe(75);
    } finally {
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });

  test("recomputes strict ok from filtered result", async () => {
    const workspace = createWorkspace(
      [
        "/** Doc. */",
        "export function documented(): void {}",
        "",
        "export function undocumented(): void {}",
      ].join("\n")
    );

    try {
      const { result } = await runWithCapturedOutput(
        createInput(workspace.cwd, {
          strict: true,
          minCoverage: 80,
          level: "documented",
        })
      );
      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      expect(result.value.summary.percentage).toBe(100);
      expect(result.value.ok).toBe(true);
    } finally {
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });

  test("keeps JSONL output one-record-per-line when --jq is used", async () => {
    const workspace = createWorkspace(
      ["/** Doc. */", "export function alpha(): void {}"].join("\n")
    );

    try {
      const { stdout } = await runWithCapturedOutput(
        createInput(workspace.cwd, {
          outputMode: "jsonl",
          jq: ".",
        })
      );

      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    } finally {
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });

  test("falls back cleanly when jq binary is missing", async () => {
    const workspace = createWorkspace(
      "/** Doc. */\nexport function alpha() {}"
    );
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(() => {
      throw new Error("ENOENT: spawn jq");
    });

    try {
      const { result, stderr } = await runWithCapturedOutput(
        createInput(workspace.cwd, {
          jq: ".summary.percentage",
        })
      );
      expect(result.isOk()).toBe(true);
      expect(stderr).toContain("jq is not installed");
    } finally {
      spawnSpy.mockRestore();
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });

  test("discovers entrypoints from package.json outfitter.tsdoc config", async () => {
    const workspace = createConfiguredWorkspace({
      memberDir: "modules/demo",
      packageName: "@demo/pkg",
      source: "/** Doc. */\nexport function alpha() {}",
      packageJsonEntrypoints: ["modules/*/src/index.ts"],
    });

    try {
      const { result } = await runWithCapturedOutput(
        createInput(workspace.cwd)
      );
      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      expect(result.value.packages).toHaveLength(1);
      expect(result.value.packages[0]?.name).toBe(workspace.packageName);
      expect(result.value.packages[0]?.path).toContain("modules/demo");
    } finally {
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });

  test("discovers root-level package via bare src/index.ts entrypoint", async () => {
    const workspace = createConfiguredWorkspace({
      memberDir: ".",
      packageName: "@demo/root-pkg",
      source: "/** Doc. */\nexport function rootFn() {}",
      configEntrypoints: ["src/index.ts"],
    });

    try {
      const { result } = await runWithCapturedOutput(
        createInput(workspace.cwd)
      );
      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      expect(result.value.packages).toHaveLength(1);
      expect(result.value.packages[0]?.name).toBe(workspace.packageName);
    } finally {
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });

  test("discovers entrypoints from .outfitter/config.json", async () => {
    const workspace = createConfiguredWorkspace({
      memberDir: "services/api",
      packageName: "@demo/api",
      source: "/** Doc. */\nexport function ping() {}",
      configEntrypoints: ["services/*/src/index.ts"],
    });

    try {
      const { result } = await runWithCapturedOutput(
        createInput(workspace.cwd)
      );
      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      expect(result.value.packages).toHaveLength(1);
      expect(result.value.packages[0]?.name).toBe(workspace.packageName);
      expect(result.value.packages[0]?.path).toContain("services/api");
    } finally {
      rmSync(workspace.cwd, { recursive: true, force: true });
    }
  });
});

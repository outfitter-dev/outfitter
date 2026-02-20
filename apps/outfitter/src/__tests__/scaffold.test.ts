/**
 * Tests for `outfitter scaffold` command.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-scaffold-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

describe("scaffold command", () => {
  test("rejects invalid package-name input with spaces", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "acme-workspace",
          private: true,
          workspaces: ["apps/*", "packages/*"],
        },
        null,
        2
      )
    );
    mkdirSync(join(tempDir, "apps"), { recursive: true });
    mkdirSync(join(tempDir, "packages"), { recursive: true });

    const result = await runScaffold({
      target: "mcp",
      name: "Ops Hub",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("package name");
    }
  });

  test("rejects traversal target names that escape workspace placement directory", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "acme-workspace",
          private: true,
          workspaces: ["apps/*", "packages/*"],
        },
        null,
        2
      )
    );
    mkdirSync(join(tempDir, "apps"), { recursive: true });
    mkdirSync(join(tempDir, "packages"), { recursive: true });

    const escapedName = `../../scaffold-escape-${Date.now()}`;
    const escapedPath = resolve(tempDir, "apps", escapedName);

    const result = await runScaffold({
      target: "mcp",
      name: escapedName,
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("target name");
    }
    expect(existsSync(escapedPath)).toBe(false);
  });

  test("rejects absolute path style target names", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "acme-workspace",
          private: true,
          workspaces: ["apps/*", "packages/*"],
        },
        null,
        2
      )
    );
    mkdirSync(join(tempDir, "apps"), { recursive: true });
    mkdirSync(join(tempDir, "packages"), { recursive: true });

    const result = await runScaffold({
      target: "mcp",
      name: "/tmp/scaffold-escape",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("target name");
    }
  });

  test("scaffolds into an existing workspace using target placement", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "acme-workspace",
          private: true,
          workspaces: ["apps/*", "packages/*"],
        },
        null,
        2
      )
    );
    mkdirSync(join(tempDir, "apps"), { recursive: true });
    mkdirSync(join(tempDir, "packages"), { recursive: true });

    const result = await runScaffold({
      target: "mcp",
      name: "assistant-api",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.converted).toBe(false);
    expect(result.value.targetDir).toBe(join(tempDir, "apps", "assistant-api"));
    expect(result.value.postScaffold.nextSteps).toContain(
      'bun run --cwd "apps/assistant-api" dev'
    );
    expect(
      existsSync(join(tempDir, "apps", "assistant-api", "package.json"))
    ).toBe(true);
  });

  test("applies resolved dependency versions for scaffolded daemon projects", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "acme-workspace",
          private: true,
          workspaces: ["apps/*", "packages/*"],
        },
        null,
        2
      )
    );
    mkdirSync(join(tempDir, "apps"), { recursive: true });
    mkdirSync(join(tempDir, "packages"), { recursive: true });

    const result = await runScaffold({
      target: "daemon",
      name: "assistant-daemon",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const packageJson = JSON.parse(
      readFileSync(
        join(tempDir, "apps", "assistant-daemon", "package.json"),
        "utf-8"
      )
    ) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@outfitter/contracts"]).toBe("^0.4.0");
    expect(packageJson.dependencies["@outfitter/types"]).toBe("^0.2.2");
    expect(packageJson.dependencies["@outfitter/daemon"]).toBe("^0.2.3");
    expect(packageJson.dependencies["@outfitter/cli"]).toBe("^0.5.1");
    expect(packageJson.dependencies["@outfitter/logging"]).toBe("^0.4.0");
    expect(packageJson.dependencies.commander).toBe("^14.0.2");
    expect(packageJson.devDependencies["@outfitter/tooling"]).toBe("^0.2.4");
  });

  test("converts a single-package project to workspace before scaffolding", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "base-lib",
          version: "0.1.0",
          type: "module",
        },
        null,
        2
      )
    );
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "index.ts"), "export const v = 1;\n");

    const result = await runScaffold({
      target: "mcp",
      name: "assistant-api",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.converted).toBe(true);
    expect(result.value.movedExisting?.to).toBe(
      join(tempDir, "packages", "base-lib")
    );
    expect(result.value.targetDir).toBe(join(tempDir, "apps", "assistant-api"));

    const rootPackageJson = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    ) as { workspaces?: string[] };
    expect(rootPackageJson.workspaces).toEqual(["apps/*", "packages/*"]);
    expect(
      existsSync(join(tempDir, "packages", "base-lib", "src", "index.ts"))
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "apps", "assistant-api", "package.json"))
    ).toBe(true);
  });

  test("preserves non-packages workspace settings when appending patterns", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "acme-workspace",
          private: true,
          workspaces: {
            packages: ["packages/*"],
            nohoist: ["**/left-pad"],
          },
        },
        null,
        2
      )
    );
    mkdirSync(join(tempDir, "packages", "base-lib"), { recursive: true });
    writeFileSync(
      join(tempDir, "packages", "base-lib", "package.json"),
      JSON.stringify({ name: "base-lib", version: "0.1.0" }, null, 2)
    );

    const result = await runScaffold({
      target: "mcp",
      name: "assistant-api",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const rootPackageJson = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    ) as {
      workspaces?: {
        packages?: string[];
        nohoist?: string[];
      };
    };
    expect(rootPackageJson.workspaces?.packages).toEqual([
      "packages/*",
      "apps/*",
    ]);
    expect(rootPackageJson.workspaces?.nohoist).toEqual(["**/left-pad"]);
  });

  test("detects pnpm workspace root when running from a child package", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "pnpm-workspace-root",
          private: true,
        },
        null,
        2
      )
    );
    writeFileSync(
      join(tempDir, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n"
    );
    mkdirSync(join(tempDir, "packages", "base-lib"), { recursive: true });
    writeFileSync(
      join(tempDir, "packages", "base-lib", "package.json"),
      JSON.stringify({ name: "base-lib", version: "0.1.0" }, null, 2)
    );

    const cwd = join(tempDir, "packages", "base-lib");
    const result = await runScaffold({
      target: "mcp",
      name: "assistant-api",
      cwd,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.converted).toBe(false);
    expect(result.value.rootDir).toBe(tempDir);
    expect(result.value.targetDir).toBe(join(tempDir, "apps", "assistant-api"));
    expect(
      existsSync(join(tempDir, "packages", "base-lib", "package.json"))
    ).toBe(true);
  });

  test("does not create a placeholder package when scaffolding an empty directory", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    const result = await runScaffold({
      target: "cli",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.converted).toBe(true);
    expect(existsSync(join(tempDir, "apps", "cli", "package.json"))).toBe(true);
    expect(existsSync(join(tempDir, "packages", basename(tempDir)))).toBe(
      false
    );
  });

  test("returns an error for init-only targets", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    const result = await runScaffold({
      target: "minimal",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("cannot be scaffolded");
    }
  });

  test("dry run does not write files", async () => {
    const { runScaffold } = await import("../commands/scaffold.js");

    const result = await runScaffold({
      target: "cli",
      cwd: tempDir,
      force: false,
      skipInstall: true,
      dryRun: true,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.dryRunPlan).toBeDefined();
    expect(existsSync(join(tempDir, "package.json"))).toBe(false);
    expect(existsSync(join(tempDir, "apps"))).toBe(false);
    expect(existsSync(join(tempDir, "packages"))).toBe(false);
  });
});

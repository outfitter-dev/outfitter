/**
 * Tests for `outfitter migrate kit` codemod.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-migrate-kit-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

describe("migrate kit command", () => {
  test("rewrites foundation imports and package.json deps", async () => {
    const { runMigrateKit } = await import("../commands/migrate-kit.js");

    mkdirSync(join(tempDir, "src"), { recursive: true });

    writeJson(join(tempDir, "package.json"), {
      name: "demo-app",
      version: "0.1.0",
      dependencies: {
        "@outfitter/contracts": "^0.2.0",
        "@outfitter/types": "^0.2.0",
        "@outfitter/cli": "^0.2.0",
      },
    });

    writeFileSync(
      join(tempDir, "src", "index.ts"),
      [
        'import { Result } from "@outfitter/contracts";',
        'import type { Brand } from "@outfitter/types";',
        "",
        'export type UserId = Brand<string, "UserId">;',
        "export const ok = Result.ok({});",
        "",
      ].join("\n"),
      "utf-8"
    );

    const result = await runMigrateKit({
      targetDir: tempDir,
      dryRun: false,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(result.value.changedFiles.length).toBe(2);
    expect(result.value.importRewrites).toBe(2);
    expect(result.value.manifestUpdates).toBe(1);

    const source = readFileSync(join(tempDir, "src", "index.ts"), "utf-8");
    expect(source).toContain("@outfitter/kit/foundation/contracts");
    expect(source).toContain("@outfitter/kit/foundation/types");

    const packageJson = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    );

    expect(packageJson.dependencies["@outfitter/contracts"]).toBeUndefined();
    expect(packageJson.dependencies["@outfitter/types"]).toBeUndefined();
    expect(packageJson.dependencies["@outfitter/kit"]).toBe("^0.2.0");
  });

  test("supports dry-run without writing files and includes diff preview", async () => {
    const { runMigrateKit } = await import("../commands/migrate-kit.js");

    mkdirSync(join(tempDir, "src"), { recursive: true });

    const packageJsonPath = join(tempDir, "package.json");
    const sourcePath = join(tempDir, "src", "main.ts");

    writeJson(packageJsonPath, {
      name: "dry-run-app",
      version: "0.1.0",
      devDependencies: {
        "@outfitter/contracts": "~0.2.0",
      },
    });

    writeFileSync(
      sourcePath,
      'export { Result } from "@outfitter/contracts";\n',
      "utf-8"
    );

    const beforePackage = readFileSync(packageJsonPath, "utf-8");
    const beforeSource = readFileSync(sourcePath, "utf-8");

    const result = await runMigrateKit({
      targetDir: tempDir,
      dryRun: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(result.value.changedFiles.length).toBe(2);
    expect(result.value.diffs.length).toBe(2);
    expect(result.value.diffs[0]?.preview).toContain("--- a/");
    expect(result.value.diffs[0]?.preview).toContain("+++ b/");

    const afterPackage = readFileSync(packageJsonPath, "utf-8");
    const afterSource = readFileSync(sourcePath, "utf-8");

    expect(afterPackage).toBe(beforePackage);
    expect(afterSource).toBe(beforeSource);
  });

  test("is idempotent after first migration", async () => {
    const { runMigrateKit } = await import("../commands/migrate-kit.js");

    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeJson(join(tempDir, "package.json"), {
      name: "idempotent-app",
      version: "0.1.0",
      dependencies: {
        "@outfitter/contracts": "^0.2.0",
      },
    });
    writeFileSync(
      join(tempDir, "src", "main.ts"),
      'import { Result } from "@outfitter/contracts";\n',
      "utf-8"
    );

    const first = await runMigrateKit({ targetDir: tempDir, dryRun: false });
    expect(first.isOk()).toBe(true);
    if (first.isErr()) return;

    const second = await runMigrateKit({ targetDir: tempDir, dryRun: false });
    expect(second.isOk()).toBe(true);
    if (second.isErr()) return;

    expect(second.value.changedFiles).toHaveLength(0);
    expect(second.value.importRewrites).toBe(0);
    expect(second.value.manifestUpdates).toBe(0);
  });

  test("traverses workspace package manifests and source files", async () => {
    const { runMigrateKit } = await import("../commands/migrate-kit.js");

    const pkgA = join(tempDir, "packages", "pkg-a");
    const pkgB = join(tempDir, "packages", "pkg-b");

    mkdirSync(join(pkgA, "src"), { recursive: true });
    mkdirSync(join(pkgB, "src"), { recursive: true });

    writeJson(join(tempDir, "package.json"), {
      name: "workspace-root",
      private: true,
      workspaces: ["packages/*"],
      dependencies: {
        "@outfitter/types": "^0.2.0",
      },
    });

    writeJson(join(pkgA, "package.json"), {
      name: "@acme/pkg-a",
      version: "0.1.0",
      dependencies: {
        "@outfitter/contracts": "^0.2.0",
      },
    });

    writeJson(join(pkgB, "package.json"), {
      name: "@acme/pkg-b",
      version: "0.1.0",
      dependencies: {
        zod: "^4.0.0",
      },
    });

    writeFileSync(
      join(pkgA, "src", "index.ts"),
      [
        'import { Result } from "@outfitter/contracts";',
        'import { isDefined } from "@outfitter/types";',
        "export const maybe = isDefined(Result.ok(true));",
        "",
      ].join("\n"),
      "utf-8"
    );

    writeFileSync(
      join(pkgB, "src", "index.ts"),
      'export const untouched = "ok";\n',
      "utf-8"
    );

    const result = await runMigrateKit({
      targetDir: tempDir,
      dryRun: false,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    expect(result.value.packageJsonFiles).toBe(3);
    expect(result.value.sourceFiles).toBe(2);
    expect(result.value.importRewrites).toBe(2);
    expect(result.value.manifestUpdates).toBe(2);

    const rootPackage = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    );
    expect(rootPackage.dependencies["@outfitter/types"]).toBeUndefined();
    expect(rootPackage.dependencies["@outfitter/kit"]).toBe("^0.2.0");

    const pkgASource = readFileSync(join(pkgA, "src", "index.ts"), "utf-8");
    expect(pkgASource).toContain("@outfitter/kit/foundation/contracts");
    expect(pkgASource).toContain("@outfitter/kit/foundation/types");

    const pkgBSource = readFileSync(join(pkgB, "src", "index.ts"), "utf-8");
    expect(pkgBSource).toBe('export const untouched = "ok";\n');
  });

  test("keeps foundation dependency when subpath imports remain", async () => {
    const { runMigrateKit } = await import("../commands/migrate-kit.js");

    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeJson(join(tempDir, "package.json"), {
      name: "subpath-app",
      version: "0.1.0",
      dependencies: {
        "@outfitter/contracts": "^0.2.0",
      },
    });

    writeFileSync(
      join(tempDir, "src", "index.ts"),
      [
        'import { Result } from "@outfitter/contracts";',
        'import { ValidationError } from "@outfitter/contracts/errors";',
        "",
        'export const value = Result.ok(new ValidationError({ message: "x" }));',
        "",
      ].join("\n"),
      "utf-8"
    );

    const result = await runMigrateKit({ targetDir: tempDir, dryRun: false });
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;

    const source = readFileSync(join(tempDir, "src", "index.ts"), "utf-8");
    expect(source).toContain("@outfitter/kit/foundation/contracts");
    expect(source).toContain("@outfitter/contracts/errors");

    const packageJson = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    );
    expect(packageJson.dependencies["@outfitter/contracts"]).toBe("^0.2.0");
    expect(packageJson.dependencies["@outfitter/kit"]).toBe("^0.2.0");
  });

  test("returns a Result error when source tree traversal fails", async () => {
    if (process.platform === "win32") {
      return;
    }

    const { runMigrateKit } = await import("../commands/migrate-kit.js");

    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeJson(join(tempDir, "package.json"), {
      name: "broken-tree",
      version: "0.1.0",
      dependencies: {
        "@outfitter/contracts": "^0.2.0",
      },
    });

    symlinkSync("missing-target.ts", join(tempDir, "src", "broken.ts"));

    const result = await runMigrateKit({ targetDir: tempDir, dryRun: true });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain(
        "Failed to read source tree entry"
      );
    }
  });

  test("migrateKitCommand is idempotent when registered multiple times", async () => {
    const { migrateKitCommand } = await import("../commands/migrate-kit.js");

    const program = new Command();
    migrateKitCommand(program);
    migrateKitCommand(program);

    const migrate = program.commands.find(
      (command) => command.name() === "migrate"
    );
    expect(migrate).toBeDefined();
    expect(
      migrate?.commands.filter((command) => command.name() === "kit")
    ).toHaveLength(1);
  });
});

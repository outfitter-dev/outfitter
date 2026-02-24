import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizeWorkspaceExports } from "./normalize-exports";

const tempDirs: string[] = [];

function trackTempDir(dir: string): string {
  tempDirs.push(dir);
  return dir;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createWorkspaceWithUnsortedExports(): {
  readonly cwd: string;
  readonly packageJsonPath: string;
} {
  const cwd = trackTempDir(mkdtempSync(join(tmpdir(), "normalize-exports-")));
  const packageDir = join(cwd, "packages", "example");
  mkdirSync(packageDir, { recursive: true });

  writeJson(join(cwd, "package.json"), {
    name: "workspace-root",
    private: true,
    workspaces: ["packages/*"],
  });

  const packageJsonPath = join(packageDir, "package.json");
  writeJson(packageJsonPath, {
    name: "@outfitter/example",
    files: ["biome.preset.json", "config.json"],
    exports: {
      "./zeta": "./dist/zeta.js",
      ".": {
        import: {
          types: "./dist/index.d.ts",
          default: "./dist/index.js",
        },
      },
      "./alpha": "./dist/alpha.js",
    },
  });

  return { cwd, packageJsonPath };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("normalizeWorkspaceExports", () => {
  test("detects drift without writing when write=false", async () => {
    const { cwd, packageJsonPath } = createWorkspaceWithUnsortedExports();
    const before = readFileSync(packageJsonPath, "utf8");

    const result = await normalizeWorkspaceExports({ cwd, write: false });

    expect(result.changedPackages).toEqual(["packages/example"]);
    expect(readFileSync(packageJsonPath, "utf8")).toBe(before);
  });

  test("normalizes exports in place when write=true", async () => {
    const { cwd, packageJsonPath } = createWorkspaceWithUnsortedExports();

    const result = await normalizeWorkspaceExports({ cwd, write: true });

    expect(result.changedPackages).toEqual(["packages/example"]);

    const updatedManifest = JSON.parse(
      readFileSync(packageJsonPath, "utf8")
    ) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(updatedManifest.exports)).toEqual([
      ".",
      "./alpha",
      "./biome",
      "./biome.preset.json",
      "./config",
      "./config.json",
      "./package.json",
      "./zeta",
    ]);
  });
});

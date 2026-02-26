import { afterEach, beforeEach, mock } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `outfitter-update-integration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function writePackageJson(
  dir: string,
  deps: Record<string, string>,
  devDeps?: Record<string, string>
): void {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "test-project",
        version: "0.1.0",
        dependencies: deps,
        devDependencies: devDeps ?? {},
      },
      null,
      2
    )
  );
}

export function writeJson(filePath: string, data: unknown): void {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function readPackageJson(dir: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
}

export function readUpgradeReport(dir: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(dir, ".outfitter", "reports", "upgrade.json"), "utf-8")
  ) as Record<string, unknown>;
}

export function writeMigrationDoc(
  dir: string,
  shortName: string,
  version: string,
  body: string,
  breaking = true
): void {
  const filename = `outfitter-${shortName}-${version}.md`;
  const content = `---\npackage: "@outfitter/${shortName}"\nversion: ${version}\nbreaking: ${breaking}\n---\n\n${body}\n`;
  writeFileSync(join(dir, filename), content);
}

export let tempDir = "";
export let spawnCalls: Array<{ cmd: string[]; cwd?: string }> = [];

const originalSpawn = Bun.spawn;

/**
 * Mock both npm version queries and bun install.
 *
 * `versionMap` maps package names to their "latest" version.
 * If a package is not in the map, the npm query returns null (failure).
 */
export function mockNpmAndInstall(versionMap: Record<string, string>): void {
  const mockSpawn = (
    cmd: string[],
    opts?: { cwd?: string; stdout?: string; stderr?: string }
  ) => {
    const cmdArray = Array.isArray(cmd) ? cmd : [cmd];

    if (
      cmdArray[0] === "npm" &&
      cmdArray[1] === "view" &&
      cmdArray[3] === "version"
    ) {
      const pkgName = cmdArray[2] ?? "";
      const version = versionMap[pkgName];

      spawnCalls.push({ cmd: cmdArray, cwd: opts?.cwd });

      if (version) {
        return {
          stdout: new Response(version).body,
          stderr: new Response("").body,
          exited: Promise.resolve(0),
        };
      }
      return {
        stdout: new Response("").body,
        stderr: new Response("Not found").body,
        exited: Promise.resolve(1),
      };
    }

    if (cmdArray[0] === "bun" && cmdArray[1] === "install") {
      spawnCalls.push({ cmd: cmdArray, cwd: opts?.cwd });
      return {
        stdout: new Response("").body,
        stderr: new Response("").body,
        exited: Promise.resolve(0),
      };
    }

    return originalSpawn(cmd, opts as Parameters<typeof Bun.spawn>[1]);
  };

  Object.assign(Bun, { spawn: mockSpawn });
}

export function setupUpgradeIntegrationHarness(): void {
  beforeEach(() => {
    tempDir = createTempDir();
    spawnCalls = [];
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    mock.restore();
  });
}

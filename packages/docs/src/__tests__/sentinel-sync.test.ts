import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const decoder = new TextDecoder();
const sentinelSyncScriptPath = fileURLToPath(
  new URL("../core/sentinel-sync.ts", import.meta.url)
);

async function createWorkspaceFixture(readmeContent: string): Promise<string> {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "outfitter-sentinel-sync-test-")
  );
  const pkgRoot = join(workspaceRoot, "packages", "alpha");

  await mkdir(join(workspaceRoot, "docs"), { recursive: true });
  await mkdir(pkgRoot, { recursive: true });

  await writeFile(
    join(pkgRoot, "package.json"),
    JSON.stringify({ name: "@acme/alpha", version: "0.0.1" })
  );
  await writeFile(join(workspaceRoot, "docs", "README.md"), readmeContent);

  return workspaceRoot;
}

function runSentinelSync(workspaceRoot: string): {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  const result = Bun.spawnSync({
    cmd: [process.execPath, sentinelSyncScriptPath, "--cwd", workspaceRoot],
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr),
  };
}

describe("sentinel-sync script", () => {
  const workspaceRoots = new Set<string>();

  afterEach(async () => {
    for (const workspaceRoot of workspaceRoots) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
    workspaceRoots.clear();
  });

  it("fails when PACKAGE_LIST sentinel markers are missing", async () => {
    const workspaceRoot = await createWorkspaceFixture(
      "# Docs\n\nNo sentinels.\n"
    );
    workspaceRoots.add(workspaceRoot);

    const result = runSentinelSync(workspaceRoot);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "docs/README.md is missing PACKAGE_LIST sentinel markers."
    );
  });

  it("updates README when PACKAGE_LIST sentinel markers are present", async () => {
    const workspaceRoot = await createWorkspaceFixture(
      [
        "# Docs",
        "",
        "<!-- BEGIN:GENERATED:PACKAGE_LIST -->",
        "stale generated content",
        "<!-- END:GENERATED:PACKAGE_LIST -->",
        "",
      ].join("\n")
    );
    workspaceRoots.add(workspaceRoot);

    const result = runSentinelSync(workspaceRoot);
    const updatedReadme = await readFile(
      join(workspaceRoot, "docs", "README.md"),
      "utf8"
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "docs/README.md updated with generated package list.\n"
    );
    expect(updatedReadme).toContain("| Package | Description |");
    expect(updatedReadme).toContain(
      "| [`@acme/alpha`](../packages/alpha/) | |"
    );
    expect(updatedReadme).not.toContain("stale generated content");
  });
});

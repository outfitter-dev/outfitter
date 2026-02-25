import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT_PATH = join(import.meta.dir, "pre-commit-typecheck.sh");

function createShimBinDir(logFile: string): string {
  const binDir = mkdtempSync(join(tmpdir(), "pre-commit-typecheck-bin-"));

  const bunShim = join(binDir, "bun");
  writeFileSync(
    bunShim,
    `#!/usr/bin/env bash
set -euo pipefail
echo "bun:$*" >> "${logFile}"
if [[ "\${1:-}" == "-e" ]]; then
  exec "${Bun.which("bun")}" "$@"
fi
exit 0
`
  );

  const turboShim = join(binDir, "turbo");
  writeFileSync(
    turboShim,
    `#!/usr/bin/env bash
set -euo pipefail
echo "turbo:$*" >> "${logFile}"
exit 0
`
  );

  Bun.spawnSync(["chmod", "+x", bunShim, turboShim]);
  return binDir;
}

function runScript(stagedFiles: string[], logFile: string): string {
  const binDir = createShimBinDir(logFile);
  const result = Bun.spawnSync([SCRIPT_PATH, ...stagedFiles], {
    cwd: join(import.meta.dir, ".."),
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `script failed: ${result.exitCode}\nstdout: ${result.stdout.toString()}\nstderr: ${result.stderr.toString()}`
    );
  }

  return readFileSync(logFile, "utf-8");
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("pre-commit-typecheck hook", () => {
  test("runs full typecheck when a root-level TS file is staged", () => {
    const tmp = mkdtempSync(join(tmpdir(), "pre-commit-typecheck-test-"));
    tempDirs.push(tmp);
    const logFile = join(tmp, "calls.log");
    writeFileSync(logFile, "");

    const log = runScript(["scripts/normalize-exports.ts"], logFile);

    expect(log).toContain("bun:run typecheck -- --only");
    expect(log).not.toContain("turbo:run typecheck");
  });

  test("runs filtered typecheck for workspace-only TS files", () => {
    const tmp = mkdtempSync(join(tmpdir(), "pre-commit-typecheck-test-"));
    tempDirs.push(tmp);
    const logFile = join(tmp, "calls.log");
    writeFileSync(logFile, "");

    const log = runScript(["packages/tooling/src/cli/pre-push.ts"], logFile);

    expect(log).toContain(
      "bun:x turbo run typecheck --no-daemon --only --filter=@outfitter/tooling"
    );
    expect(log).not.toContain("bun:run typecheck -- --only");
  });

  test("runs full typecheck when root-level and workspace TS files are both staged", () => {
    const tmp = mkdtempSync(join(tmpdir(), "pre-commit-typecheck-test-"));
    tempDirs.push(tmp);
    const logFile = join(tmp, "calls.log");
    writeFileSync(logFile, "");

    const log = runScript(
      ["scripts/normalize-exports.ts", "packages/tooling/src/cli/pre-push.ts"],
      logFile
    );

    expect(log).toContain("bun:run typecheck -- --only");
    expect(log).not.toContain("bun:x turbo run typecheck");
  });
});

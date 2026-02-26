import { afterEach, beforeEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Read expected versions directly from workspace package.json files,
 * independent of the resolver under test, so resolver bugs don't mask
 * test failures.
 */
export function workspaceVersion(pkg: string): string {
  const name = pkg.replace("@outfitter/", "");
  const raw = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "..",
      "packages",
      name,
      "package.json"
    ),
    "utf-8"
  );
  return `^${JSON.parse(raw).version}`;
}

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `outfitter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function captureStdout(
  fn: () => void | Promise<void>
): Promise<string> {
  let stdout = "";
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stdout.write;

  try {
    await fn();
  } finally {
    process.stdout.write = originalWrite;
  }

  return stdout;
}

export let tempDir = "";

export function setupInitTestHarness(): void {
  let originalIsTTY: boolean | undefined;
  let originalDisablePostScaffold: string | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    originalDisablePostScaffold =
      process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"];
    process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"] = "1";
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    if (originalDisablePostScaffold === undefined) {
      delete process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"];
    } else {
      process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"] =
        originalDisablePostScaffold;
    }
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });
}

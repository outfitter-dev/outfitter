import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const decoder = new TextDecoder();
const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

describe("command entry type exports", () => {
  test("re-exports CLI and command-related types", () => {
    const result = Bun.spawnSync(
      [
        "bunx",
        "tsc",
        "--noEmit",
        "--pretty",
        "false",
        "-p",
        "packages/cli/tsconfig.command-exports.json",
      ],
      {
        cwd: repoRoot,
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    if (result.exitCode !== 0) {
      const stdout = decoder.decode(result.stdout);
      const stderr = decoder.decode(result.stderr);
      console.error(stdout || stderr);
    }

    expect(result.exitCode).toBe(0);
  });
});

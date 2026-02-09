import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrap } from "../bootstrap.js";

describe("bootstrap", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bootstrap-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("force (mocked subprocesses)", () => {
    let spawnSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      spawnSpy = spyOn(Bun, "spawnSync").mockReturnValue({
        exitCode: 0,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
        success: true,
      } as ReturnType<typeof Bun.spawnSync>);
    });

    afterEach(() => {
      spawnSpy.mockRestore();
    });

    test("calls extend callback when provided", async () => {
      let extendCalled = false;

      await Bun.write(join(tempDir, "node_modules/.keep"), "");
      await Bun.write(join(tempDir, "package.json"), "{}");

      await bootstrap({
        quiet: true,
        force: true,
        extend: async () => {
          extendCalled = true;
        },
      });

      expect(extendCalled).toBe(true);
    });

    test("bypasses fast-path", async () => {
      let extendCalled = false;

      await Bun.write(join(tempDir, "node_modules/.keep"), "");
      await Bun.write(join(tempDir, "package.json"), "{}");

      await bootstrap({
        quiet: true,
        force: true,
        extend: async () => {
          extendCalled = true;
        },
      });

      expect(extendCalled).toBe(true);
    });

    test("completes without error in quiet mode", async () => {
      await Bun.write(join(tempDir, "node_modules/.keep"), "");
      await Bun.write(join(tempDir, "package.json"), "{}");

      await expect(
        bootstrap({ quiet: true, force: true })
      ).resolves.toBeUndefined();
    });
  });

  test("fast-path exits early when all tools and node_modules present", async () => {
    await Bun.write(join(tempDir, "node_modules/.keep"), "");

    const toolsExist =
      Bun.spawnSync(["which", "bun"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gh"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gt"]).exitCode === 0 &&
      Bun.spawnSync(["which", "markdownlint-cli2"]).exitCode === 0;

    if (!toolsExist) {
      return;
    }

    let extendCalled = false;

    await bootstrap({
      quiet: true,
      force: false,
      extend: async () => {
        extendCalled = true;
      },
    });

    expect(extendCalled).toBe(false);
  });

  test("additional tools in list are checked for fast-path", async () => {
    await Bun.write(join(tempDir, "node_modules/.keep"), "");

    const coreToolsExist =
      Bun.spawnSync(["which", "bun"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gh"]).exitCode === 0 &&
      Bun.spawnSync(["which", "gt"]).exitCode === 0 &&
      Bun.spawnSync(["which", "markdownlint-cli2"]).exitCode === 0;

    if (!coreToolsExist) {
      return;
    }

    await expect(
      bootstrap({
        quiet: true,
        tools: ["nonexistent-tool-xyz-123"],
      })
    ).rejects.toThrow();
  });
});

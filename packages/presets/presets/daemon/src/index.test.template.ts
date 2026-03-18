import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDaemon } from "@outfitter/daemon";

import { runDaemon } from "./index.js";

describe("public API surface", () => {
  test("exports runDaemon function", () => {
    expect(typeof runDaemon).toBe("function");
  });
});

describe("daemon lifecycle", () => {
  test("starts and stops cleanly", async () => {
    const pidFile = join(tmpdir(), `test-daemon-${Date.now()}.pid`);
    const daemon = createDaemon({ name: "test", pidFile });

    expect(daemon.state).toBe("stopped");
    expect(daemon.isRunning()).toBe(false);

    const startResult = await daemon.start();
    expect(startResult.isOk()).toBe(true);
    expect(daemon.state).toBe("running");
    expect(daemon.isRunning()).toBe(true);

    const stopResult = await daemon.stop();
    expect(stopResult.isOk()).toBe(true);
    expect(daemon.state).toBe("stopped");
    expect(daemon.isRunning()).toBe(false);
  });

  test("rejects double start", async () => {
    const pidFile = join(tmpdir(), `test-daemon-dbl-${Date.now()}.pid`);
    const daemon = createDaemon({ name: "test", pidFile });

    const firstStart = await daemon.start();
    expect(firstStart.isOk()).toBe(true);

    const secondStart = await daemon.start();
    expect(secondStart.isErr()).toBe(true);
    if (secondStart.isErr()) {
      expect(secondStart.error.message).toContain("already running");
    }

    await daemon.stop();
  });

  test("runs shutdown handlers on stop", async () => {
    const pidFile = join(tmpdir(), `test-daemon-sd-${Date.now()}.pid`);
    const daemon = createDaemon({ name: "test", pidFile });
    let shutdownCalled = false;

    daemon.onShutdown(async () => {
      shutdownCalled = true;
    });

    const startResult = await daemon.start();
    expect(startResult.isOk()).toBe(true);

    const stopResult = await daemon.stop();
    expect(stopResult.isOk()).toBe(true);

    expect(shutdownCalled).toBe(true);
  });
});

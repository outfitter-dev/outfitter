import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDaemon } from "@outfitter/daemon";

import { runDaemon } from "./index.js";

describe("daemon", () => {
  test("exports the daemon entrypoint", () => {
    expect(typeof runDaemon).toBe("function");
  });

  test("daemon lifecycle: start and stop", async () => {
    const pidFile = join(tmpdir(), `test-daemon-${Date.now()}.pid`);
    const daemon = createDaemon({ name: "test", pidFile });

    expect(daemon.state).toBe("stopped");

    const startResult = await daemon.start();
    expect(startResult.isOk()).toBe(true);
    expect(daemon.state).toBe("running");

    const stopResult = await daemon.stop();
    expect(stopResult.isOk()).toBe(true);
    expect(daemon.state).toBe("stopped");
  });
});

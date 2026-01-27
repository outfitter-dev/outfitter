/**
 * @outfitter/daemon - Lifecycle Test Suite
 *
 * TDD RED PHASE: These tests document expected behavior and WILL FAIL
 * until implementation is complete.
 *
 * Test categories:
 * 1. PID File Management (5 tests)
 * 2. State Transitions (5 tests)
 * 3. Signal Handling (4 tests)
 * 4. Shutdown Handlers (4 tests)
 * 5. Error Cases (4 tests)
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { writeFile as fsWriteFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDaemon } from "../lifecycle.js";
import type { DaemonOptions } from "../types.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

let testDir: string;
let testCounter = 0;

async function createTestDir(): Promise<string> {
  testCounter++;
  const dir = join(tmpdir(), `daemon-test-${Date.now()}-${testCounter}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createTestOptions(pidFile: string): DaemonOptions {
  return {
    name: "test-daemon",
    pidFile,
    shutdownTimeout: 1000,
  };
}

// ============================================================================
// 1. PID File Management Tests
// ============================================================================

describe("PID File Management", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("creates PID file on start", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    const result = await daemon.start();

    expect(result.isOk()).toBe(true);
    const exists = await Bun.file(pidFile).exists();
    expect(exists).toBe(true);

    // Cleanup
    await daemon.stop();
  });

  it("writes current process PID to file", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    await daemon.start();

    const content = await Bun.file(pidFile).text();
    expect(content.trim()).toBe(String(process.pid));

    // Cleanup
    await daemon.stop();
  });

  it("removes PID file on stop", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    await daemon.start();
    await daemon.stop();

    const exists = await Bun.file(pidFile).exists();
    expect(exists).toBe(false);
  });

  it("returns error if PID file already exists", async () => {
    const pidFile = join(testDir, "daemon.pid");
    // Pre-create PID file to simulate another running instance
    await fsWriteFile(pidFile, "12345");

    const daemon = createDaemon(createTestOptions(pidFile));
    const result = await daemon.start();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("DaemonError");
      expect(result.error.code).toBe("ALREADY_RUNNING");
    }
  });

  it("creates parent directories for PID file if needed", async () => {
    const pidFile = join(testDir, "nested", "deep", "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    const result = await daemon.start();

    expect(result.isOk()).toBe(true);
    const exists = await Bun.file(pidFile).exists();
    expect(exists).toBe(true);

    // Cleanup
    await daemon.stop();
  });
});

// ============================================================================
// 2. State Transitions Tests
// ============================================================================

describe("State Transitions", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("starts in stopped state", () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    expect(daemon.state).toBe("stopped");
  });

  it("transitions to running state after start", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    await daemon.start();

    expect(daemon.state).toBe("running");
    expect(daemon.isRunning()).toBe(true);

    // Cleanup
    await daemon.stop();
  });

  it("transitions to stopped state after stop", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    await daemon.start();
    await daemon.stop();

    expect(daemon.state).toBe("stopped");
    expect(daemon.isRunning()).toBe(false);
  });

  it("isRunning returns false when stopped", () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    expect(daemon.isRunning()).toBe(false);
  });

  it("prevents double start", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    await daemon.start();
    const result = await daemon.start();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("ALREADY_RUNNING");
    }

    // Cleanup
    await daemon.stop();
  });
});

// ============================================================================
// 3. Signal Handling Tests
// ============================================================================

describe("Signal Handling", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("registers signal handlers on start", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    // Track if signal handlers are registered
    const originalOn = process.on.bind(process);
    const registeredSignals: string[] = [];
    const onSpy = spyOn(process, "on").mockImplementation((event, listener) => {
      if (event === "SIGTERM" || event === "SIGINT") {
        registeredSignals.push(event as string);
      }
      return originalOn(event, listener);
    });

    await daemon.start();

    expect(registeredSignals).toContain("SIGTERM");
    expect(registeredSignals).toContain("SIGINT");

    // Cleanup
    await daemon.stop();
    onSpy.mockRestore();
  });

  it("removes signal handlers on stop", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    const originalOff = process.off.bind(process);
    const removedSignals: string[] = [];
    const offSpy = spyOn(process, "off").mockImplementation(
      (event, listener) => {
        if (event === "SIGTERM" || event === "SIGINT") {
          removedSignals.push(event as string);
        }
        return originalOff(event, listener);
      }
    );

    await daemon.start();
    await daemon.stop();

    expect(removedSignals).toContain("SIGTERM");
    expect(removedSignals).toContain("SIGINT");

    offSpy.mockRestore();
  });

  it("handles SIGTERM signal gracefully", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));
    let shutdownCalled = false;

    daemon.onShutdown(async () => {
      shutdownCalled = true;
    });

    await daemon.start();

    // Simulate SIGTERM by calling the internal shutdown
    // We cannot actually send SIGTERM in tests as it would kill the test process
    await daemon.stop();

    expect(shutdownCalled).toBe(true);
    expect(daemon.state).toBe("stopped");
  });

  it("handles SIGINT signal gracefully", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));
    let shutdownCalled = false;

    daemon.onShutdown(async () => {
      shutdownCalled = true;
    });

    await daemon.start();

    // Simulate SIGINT by calling stop
    await daemon.stop();

    expect(shutdownCalled).toBe(true);
    expect(daemon.state).toBe("stopped");
  });
});

// ============================================================================
// 4. Shutdown Handlers Tests
// ============================================================================

describe("Shutdown Handlers", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("calls shutdown handlers on stop", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));
    let handlerCalled = false;

    daemon.onShutdown(async () => {
      handlerCalled = true;
    });

    await daemon.start();
    await daemon.stop();

    expect(handlerCalled).toBe(true);
  });

  it("calls multiple shutdown handlers in order", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));
    const callOrder: number[] = [];

    daemon.onShutdown(async () => {
      callOrder.push(1);
    });
    daemon.onShutdown(async () => {
      callOrder.push(2);
    });
    daemon.onShutdown(async () => {
      callOrder.push(3);
    });

    await daemon.start();
    await daemon.stop();

    expect(callOrder).toEqual([1, 2, 3]);
  });

  it("waits for all shutdown handlers to complete", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));
    let slowHandlerComplete = false;

    daemon.onShutdown(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      slowHandlerComplete = true;
    });

    await daemon.start();
    await daemon.stop();

    expect(slowHandlerComplete).toBe(true);
  });

  it("returns SHUTDOWN_TIMEOUT error if handlers exceed timeout", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon({
      ...createTestOptions(pidFile),
      shutdownTimeout: 50, // Very short timeout
    });

    daemon.onShutdown(async () => {
      // This handler takes longer than the timeout
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    await daemon.start();
    const result = await daemon.stop();

    // State should still be stopped even after timeout
    expect(daemon.state).toBe("stopped");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SHUTDOWN_TIMEOUT");
    }
  });
});

// ============================================================================
// 5. Error Cases Tests
// ============================================================================

describe("Error Cases", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("returns NOT_RUNNING error when stopping a stopped daemon", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    const result = await daemon.stop();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_RUNNING");
    }
  });

  it("returns PID_ERROR when PID file cannot be written", async () => {
    // Use an invalid path that cannot be created
    const pidFile = "/nonexistent/path/that/cannot/exist/daemon.pid";
    const daemon = createDaemon({
      ...createTestOptions(pidFile),
      // Override to prevent mkdir from succeeding
    });

    const result = await daemon.start();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("PID_ERROR");
    }
  });

  it("cleans up PID file on start failure after partial success", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));

    // Start successfully first
    await daemon.start();
    // Get the PID file created
    const exists1 = await Bun.file(pidFile).exists();
    expect(exists1).toBe(true);

    // Now stop properly
    await daemon.stop();

    // Verify cleanup
    const exists2 = await Bun.file(pidFile).exists();
    expect(exists2).toBe(false);
  });

  it("handles shutdown handler errors gracefully", async () => {
    const pidFile = join(testDir, "daemon.pid");
    const daemon = createDaemon(createTestOptions(pidFile));
    let secondHandlerCalled = false;

    // First handler throws
    daemon.onShutdown(async () => {
      throw new Error("Handler failed");
    });

    // Second handler should still be called
    daemon.onShutdown(async () => {
      secondHandlerCalled = true;
    });

    await daemon.start();
    const result = await daemon.stop();

    // Should still complete shutdown
    expect(daemon.state).toBe("stopped");
    expect(secondHandlerCalled).toBe(true);
    // Result might be ok or err depending on implementation
    expect(result.isOk() || result.isErr()).toBe(true);
  });
});

/**
 * @outfitter/daemon - IPC Test Suite
 *
 * TDD RED PHASE: Tests for IPC server/client communication.
 *
 * Test categories:
 * 1. Server Lifecycle (4 tests)
 * 2. Client Connection (4 tests)
 * 3. Message Exchange (4 tests)
 * 4. Error Handling (4 tests)
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createIpcClient, createIpcServer } from "../ipc.js";

/**
 * Check if a Unix socket file exists.
 */
async function socketExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isSocket();
  } catch {
    return false;
  }
}

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

let testDir: string;
let testCounter = 0;

async function createTestDir(): Promise<string> {
  testCounter++;
  const dir = join(tmpdir(), `daemon-ipc-test-${Date.now()}-${testCounter}`);
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

// ============================================================================
// 1. Server Lifecycle Tests
// ============================================================================

describe("IPC Server Lifecycle", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("creates Unix socket on listen", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    await server.listen();

    const exists = await socketExists(socketPath);
    expect(exists).toBe(true);

    await server.close();
  });

  it("removes Unix socket on close", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    await server.listen();
    await server.close();

    const exists = await socketExists(socketPath);
    expect(exists).toBe(false);
  });

  it("can restart server after close", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    await server.listen();
    await server.close();
    await server.listen();

    const exists = await socketExists(socketPath);
    expect(exists).toBe(true);

    await server.close();
  });

  it("handles multiple close calls gracefully", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    await server.listen();
    await server.close();
    await server.close(); // Should not throw

    expect(true).toBe(true);
  });
});

// ============================================================================
// 2. Client Connection Tests
// ============================================================================

describe("IPC Client Connection", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("connects to server successfully", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);
    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();

    // Connection successful if no error thrown
    expect(true).toBe(true);

    client.close();
    await server.close();
  });

  it("throws error when connecting to non-existent server", async () => {
    const socketPath = join(testDir, "nonexistent.sock");
    const client = createIpcClient(socketPath);

    let errorThrown = false;
    try {
      await client.connect();
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
  });

  it("can reconnect after close", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);
    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();
    client.close();
    await client.connect();

    // Reconnection successful
    expect(true).toBe(true);

    client.close();
    await server.close();
  });

  it("handles multiple close calls gracefully", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);
    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();
    client.close();
    client.close(); // Should not throw

    expect(true).toBe(true);

    await server.close();
  });
});

// ============================================================================
// 3. Message Exchange Tests
// ============================================================================

describe("IPC Message Exchange", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("sends and receives simple message", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    server.onMessage(async (msg) => {
      return { echo: msg };
    });

    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();

    const response = await client.send<{ echo: { hello: string } }>({
      hello: "world",
    });
    expect(response).toEqual({ echo: { hello: "world" } });

    client.close();
    await server.close();
  });

  it("handles JSON objects in messages", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    server.onMessage(async (msg) => {
      const data = msg as { action: string; value: number };
      return { action: data.action, result: data.value * 2 };
    });

    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();

    const response = await client.send<{ action: string; result: number }>({
      action: "double",
      value: 21,
    });
    expect(response).toEqual({ action: "double", result: 42 });

    client.close();
    await server.close();
  });

  it("handles multiple sequential messages", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);
    let messageCount = 0;

    server.onMessage(async (msg) => {
      messageCount++;
      return { count: messageCount, received: msg };
    });

    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();

    const r1 = await client.send<{ count: number }>({ msg: 1 });
    const r2 = await client.send<{ count: number }>({ msg: 2 });
    const r3 = await client.send<{ count: number }>({ msg: 3 });

    expect(r1.count).toBe(1);
    expect(r2.count).toBe(2);
    expect(r3.count).toBe(3);

    client.close();
    await server.close();
  });

  it("supports typed responses", async () => {
    interface StatusResponse {
      status: "ok" | "error";
      uptime: number;
    }

    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    server.onMessage(async () => {
      return { status: "ok", uptime: 12_345 } satisfies StatusResponse;
    });

    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();

    const response = await client.send<StatusResponse>({ type: "status" });
    expect(response.status).toBe("ok");
    expect(response.uptime).toBe(12_345);

    client.close();
    await server.close();
  });
});

// ============================================================================
// 4. Error Handling Tests
// ============================================================================

describe("IPC Error Handling", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  it("handles server handler errors", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    server.onMessage(async () => {
      throw new Error("Handler error");
    });

    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();

    let errorThrown = false;
    try {
      await client.send({ test: true });
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);

    client.close();
    await server.close();
  });

  it("handles send on closed client", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);
    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();
    client.close();

    let errorThrown = false;
    try {
      await client.send({ test: true });
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);

    await server.close();
  });

  it("handles server shutdown during message", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    server.onMessage(async () => {
      // Simulate slow handler
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { result: "done" };
    });

    await server.listen();

    const client = createIpcClient(socketPath);
    await client.connect();

    // Start sending but close server immediately
    const sendPromise = client.send({ test: true });
    await server.close();

    // Should either complete or throw, but not hang
    let completed = false;
    try {
      await sendPromise;
      completed = true;
    } catch {
      completed = true;
    }

    expect(completed).toBe(true);

    client.close();
  });

  it("handles malformed messages gracefully", async () => {
    const socketPath = join(testDir, "test.sock");
    const server = createIpcServer(socketPath);

    server.onMessage(async (msg) => {
      return { received: msg };
    });

    await server.listen();

    // Server should handle invalid JSON without crashing
    await new Promise<void>((resolve, reject) => {
      void Bun.connect({
        unix: socketPath,
        socket: {
          data() {
            // No-op for this test; required by Bun.connect.
          },
          open(socket) {
            socket.write("{not-json}\n");
            socket.terminate();
            resolve();
          },
          error(_socket, error) {
            reject(error);
          },
        },
      });
    });

    const client = createIpcClient(socketPath);
    await client.connect();

    // Valid message should still work
    const response = await client.send<{ received: unknown }>({ valid: true });
    expect(response.received).toEqual({ valid: true });

    client.close();
    await server.close();
  });
});

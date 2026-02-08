/**
 * Tests for MCP Resource Subscriptions (OS-60)
 *
 * Verifies URI subscription tracking and notifications.
 */
import { describe, expect, it } from "bun:test";
import { createMcpServer } from "../index.js";

describe("Resource Subscriptions", () => {
  it("subscribe adds URI to tracking", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.subscribe("file:///watched.txt");
    // No assertion for internal state — the effect is tested via notification
  });

  it("unsubscribe removes URI", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.subscribe("file:///watched.txt");
    server.unsubscribe("file:///watched.txt");
    // Verified via notification test below
  });

  it("notification only for subscribed URIs", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: string[] = [];
    const mockSdkServer = {
      sendResourceUpdated: (params: { uri: string }) =>
        notifications.push(params.uri),
      sendToolListChanged: () => {
        // no-op
      },
      sendResourceListChanged: () => {
        // no-op
      },
      sendPromptListChanged: () => {
        // no-op
      },
    };

    server.bindSdkServer?.(mockSdkServer);
    server.subscribe("file:///watched.txt");

    // Notify for subscribed URI
    server.notifyResourceUpdated("file:///watched.txt");
    expect(notifications).toEqual(["file:///watched.txt"]);

    // Notify for unsubscribed URI — should be ignored
    server.notifyResourceUpdated("file:///unwatched.txt");
    expect(notifications).toEqual(["file:///watched.txt"]);
  });

  it("notification after unsubscribe is ignored", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: string[] = [];
    const mockSdkServer = {
      sendResourceUpdated: (params: { uri: string }) =>
        notifications.push(params.uri),
      sendToolListChanged: () => {
        // no-op
      },
      sendResourceListChanged: () => {
        // no-op
      },
      sendPromptListChanged: () => {
        // no-op
      },
    };

    server.bindSdkServer?.(mockSdkServer);
    server.subscribe("file:///temp.txt");
    server.unsubscribe("file:///temp.txt");

    server.notifyResourceUpdated("file:///temp.txt");
    expect(notifications).toEqual([]);
  });

  it("idempotent subscribe", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    const notifications: string[] = [];
    const mockSdkServer = {
      sendResourceUpdated: (params: { uri: string }) =>
        notifications.push(params.uri),
      sendToolListChanged: () => {
        // no-op
      },
      sendResourceListChanged: () => {
        // no-op
      },
      sendPromptListChanged: () => {
        // no-op
      },
    };

    server.bindSdkServer?.(mockSdkServer);

    // Subscribe twice
    server.subscribe("file:///double.txt");
    server.subscribe("file:///double.txt");

    // Should still only get one notification
    server.notifyResourceUpdated("file:///double.txt");
    expect(notifications).toEqual(["file:///double.txt"]);
  });

  it("no-op before SDK binding", () => {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
    });

    server.subscribe("file:///early.txt");
    // Should not throw
    expect(() =>
      server.notifyResourceUpdated("file:///early.txt")
    ).not.toThrow();
  });
});

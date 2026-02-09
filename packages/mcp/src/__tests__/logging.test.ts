/**
 * Tests for MCP Server-to-Client Logging (OS-57)
 *
 * Verifies log level mapping, level filtering, and sendLogMessage integration.
 */
import { describe, expect, it } from "bun:test";
import { createMcpServer, mapLogLevelToMcp, shouldEmitLog } from "../index.js";

describe("MCP Logging", () => {
  describe("level mapping", () => {
    it("maps trace to debug", () => {
      expect(mapLogLevelToMcp("trace")).toBe("debug");
    });

    it("maps debug to debug", () => {
      expect(mapLogLevelToMcp("debug")).toBe("debug");
    });

    it("maps info to info", () => {
      expect(mapLogLevelToMcp("info")).toBe("info");
    });

    it("maps warn to warning", () => {
      expect(mapLogLevelToMcp("warn")).toBe("warning");
    });

    it("maps error to error", () => {
      expect(mapLogLevelToMcp("error")).toBe("error");
    });

    it("maps fatal to emergency", () => {
      expect(mapLogLevelToMcp("fatal")).toBe("emergency");
    });
  });

  describe("shouldEmitLog", () => {
    it("debug threshold allows all levels", () => {
      expect(shouldEmitLog("debug", "debug")).toBe(true);
      expect(shouldEmitLog("info", "debug")).toBe(true);
      expect(shouldEmitLog("warning", "debug")).toBe(true);
      expect(shouldEmitLog("error", "debug")).toBe(true);
      expect(shouldEmitLog("emergency", "debug")).toBe(true);
    });

    it("error threshold filters out debug/info/warning", () => {
      expect(shouldEmitLog("debug", "error")).toBe(false);
      expect(shouldEmitLog("info", "error")).toBe(false);
      expect(shouldEmitLog("warning", "error")).toBe(false);
      expect(shouldEmitLog("error", "error")).toBe(true);
      expect(shouldEmitLog("emergency", "error")).toBe(true);
    });

    it("emergency threshold only allows emergency", () => {
      expect(shouldEmitLog("error", "emergency")).toBe(false);
      expect(shouldEmitLog("emergency", "emergency")).toBe(true);
    });
  });

  describe("sendLogMessage", () => {
    it("sends log message via SDK server", () => {
      const server = createMcpServer({
        name: "test-server",
        version: "1.0.0",
      });

      const sentMessages: unknown[] = [];
      const mockSdkServer = {
        sendLoggingMessage: (params: unknown) => {
          sentMessages.push(params);
          return Promise.resolve();
        },
        sendToolListChanged: () => Promise.resolve(),
        sendResourceListChanged: () => Promise.resolve(),
        sendPromptListChanged: () => Promise.resolve(),
      };

      server.bindSdkServer?.(mockSdkServer);
      server.setLogLevel?.("debug");
      server.sendLogMessage("info", { action: "test" }, "my-logger");

      expect(sentMessages).toHaveLength(1);
      const msg = sentMessages[0] as {
        level: string;
        data: unknown;
        logger?: string;
      };
      expect(msg.level).toBe("info");
      expect(msg.data).toEqual({ action: "test" });
      expect(msg.logger).toBe("my-logger");
    });

    it("filters messages below client-requested level", () => {
      const server = createMcpServer({
        name: "test-server",
        version: "1.0.0",
      });

      const sentMessages: unknown[] = [];
      const mockSdkServer = {
        sendLoggingMessage: (params: unknown) => {
          sentMessages.push(params);
          return Promise.resolve();
        },
        sendToolListChanged: () => Promise.resolve(),
        sendResourceListChanged: () => Promise.resolve(),
        sendPromptListChanged: () => Promise.resolve(),
      };

      server.bindSdkServer?.(mockSdkServer);
      server.setLogLevel?.("error");

      // Below threshold — should be filtered
      server.sendLogMessage("debug", "debug msg");
      server.sendLogMessage("info", "info msg");
      server.sendLogMessage("warning", "warning msg");

      // At or above threshold — should be sent
      server.sendLogMessage("error", "error msg");
      server.sendLogMessage("emergency", "emergency msg");

      expect(sentMessages).toHaveLength(2);
    });

    it("no forwarding by default until client sets level", () => {
      const server = createMcpServer({
        name: "test-server",
        version: "1.0.0",
      });

      const sentMessages: unknown[] = [];
      const mockSdkServer = {
        sendLoggingMessage: (params: unknown) => {
          sentMessages.push(params);
          return Promise.resolve();
        },
        sendToolListChanged: () => Promise.resolve(),
        sendResourceListChanged: () => Promise.resolve(),
        sendPromptListChanged: () => Promise.resolve(),
      };

      server.bindSdkServer?.(mockSdkServer);

      // Without setLogLevel, no messages should be forwarded
      server.sendLogMessage("debug", "should not pass");
      server.sendLogMessage("error", "should not pass either");
      expect(sentMessages).toHaveLength(0);

      // After client opts in, messages flow
      server.setLogLevel?.("debug");
      server.sendLogMessage("debug", "now it passes");
      expect(sentMessages).toHaveLength(1);
    });

    it("resets log level on rebind", () => {
      const server = createMcpServer({
        name: "test-server",
        version: "1.0.0",
      });

      const sentMessages: unknown[] = [];
      const makeMock = () => ({
        sendLoggingMessage: (params: unknown) => {
          sentMessages.push(params);
          return Promise.resolve();
        },
        sendToolListChanged: () => Promise.resolve(),
        sendResourceListChanged: () => Promise.resolve(),
        sendPromptListChanged: () => Promise.resolve(),
      });

      // First client sets level to debug
      server.bindSdkServer?.(makeMock());
      server.setLogLevel?.("debug");
      server.sendLogMessage("debug", "first client");
      expect(sentMessages).toHaveLength(1);

      // Rebind to new client — should reset to no forwarding
      server.bindSdkServer?.(makeMock());
      server.sendLogMessage("debug", "should not forward");
      expect(sentMessages).toHaveLength(1); // unchanged
    });

    it("no-op before SDK server binding", () => {
      const server = createMcpServer({
        name: "test-server",
        version: "1.0.0",
      });

      // Should not throw when no SDK server bound
      expect(() => server.sendLogMessage("info", "no crash")).not.toThrow();
    });

    it("omits logger field when not provided", () => {
      const server = createMcpServer({
        name: "test-server",
        version: "1.0.0",
      });

      const sentMessages: unknown[] = [];
      const mockSdkServer = {
        sendLoggingMessage: (params: unknown) => {
          sentMessages.push(params);
          return Promise.resolve();
        },
        sendToolListChanged: () => Promise.resolve(),
        sendResourceListChanged: () => Promise.resolve(),
        sendPromptListChanged: () => Promise.resolve(),
      };

      server.bindSdkServer?.(mockSdkServer);
      server.setLogLevel?.("debug");
      server.sendLogMessage("info", "test data");

      const msg = sentMessages[0] as Record<string, unknown>;
      expect(msg.logger).toBeUndefined();
      expect("logger" in msg).toBe(false);
    });

    it("accepts string data", () => {
      const server = createMcpServer({
        name: "test-server",
        version: "1.0.0",
      });

      const sentMessages: unknown[] = [];
      const mockSdkServer = {
        sendLoggingMessage: (params: unknown) => {
          sentMessages.push(params);
          return Promise.resolve();
        },
        sendToolListChanged: () => Promise.resolve(),
        sendResourceListChanged: () => Promise.resolve(),
        sendPromptListChanged: () => Promise.resolve(),
      };

      server.bindSdkServer?.(mockSdkServer);
      server.setLogLevel?.("debug");
      server.sendLogMessage("error", "something went wrong");

      const msg = sentMessages[0] as { data: unknown };
      expect(msg.data).toBe("something went wrong");
    });
  });
});

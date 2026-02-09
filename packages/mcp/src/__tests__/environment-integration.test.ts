/**
 * Tests for MCP environment profile integration (OS-71 Phase 2)
 *
 * Verifies the precedence chain for default log level:
 * OUTFITTER_LOG_LEVEL > options.defaultLogLevel > environment profile > null
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createMcpServer } from "../index.js";

describe("MCP Environment Integration", () => {
  let originalEnv: string | undefined;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    originalEnv = process.env["OUTFITTER_ENV"];
    originalLogLevel = process.env["OUTFITTER_LOG_LEVEL"];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OUTFITTER_ENV"];
    } else {
      process.env["OUTFITTER_ENV"] = originalEnv;
    }
    if (originalLogLevel === undefined) {
      delete process.env["OUTFITTER_LOG_LEVEL"];
    } else {
      process.env["OUTFITTER_LOG_LEVEL"] = originalLogLevel;
    }
  });

  function createServerWithMock(options?: { defaultLogLevel?: string | null }) {
    const server = createMcpServer({
      name: "test-server",
      version: "1.0.0",
      ...options,
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
    return { server, sentMessages };
  }

  describe("default log level precedence", () => {
    it("defaults to null in production (no forwarding)", () => {
      delete process.env["OUTFITTER_ENV"];
      delete process.env["OUTFITTER_LOG_LEVEL"];

      const { server, sentMessages } = createServerWithMock();

      server.sendLogMessage("error", "should not forward");
      expect(sentMessages).toHaveLength(0);
    });

    it("uses environment profile when OUTFITTER_ENV is set", () => {
      process.env["OUTFITTER_ENV"] = "development";
      delete process.env["OUTFITTER_LOG_LEVEL"];

      const { server, sentMessages } = createServerWithMock();

      // Development profile defaults to debug — should forward all
      server.sendLogMessage("debug", "dev debug message");
      expect(sentMessages).toHaveLength(1);
    });

    it("options.defaultLogLevel overrides environment profile", () => {
      process.env["OUTFITTER_ENV"] = "development";
      delete process.env["OUTFITTER_LOG_LEVEL"];

      // Development profile would give "debug", but options says "error"
      const { server, sentMessages } = createServerWithMock({
        defaultLogLevel: "error",
      });

      server.sendLogMessage("debug", "should be filtered");
      server.sendLogMessage("error", "should pass");
      expect(sentMessages).toHaveLength(1);
    });

    it("OUTFITTER_LOG_LEVEL overrides options.defaultLogLevel", () => {
      process.env["OUTFITTER_ENV"] = "production";
      process.env["OUTFITTER_LOG_LEVEL"] = "warning";

      // Options says "error" but env var says "warning"
      const { server, sentMessages } = createServerWithMock({
        defaultLogLevel: "error",
      });

      server.sendLogMessage("warning", "should pass via env var");
      expect(sentMessages).toHaveLength(1);
    });

    it("null defaultLogLevel disables forwarding even in development", () => {
      process.env["OUTFITTER_ENV"] = "development";
      delete process.env["OUTFITTER_LOG_LEVEL"];

      const { server, sentMessages } = createServerWithMock({
        defaultLogLevel: null,
      });

      server.sendLogMessage("debug", "should not forward");
      expect(sentMessages).toHaveLength(0);
    });

    it("ignores invalid OUTFITTER_LOG_LEVEL values", () => {
      process.env["OUTFITTER_ENV"] = "development";
      process.env["OUTFITTER_LOG_LEVEL"] = "verbose";

      // Invalid env var should fall through to options, then profile
      const { server, sentMessages } = createServerWithMock();

      // Falls through to development profile (debug)
      server.sendLogMessage("debug", "should forward via profile");
      expect(sentMessages).toHaveLength(1);
    });

    it("client setLogLevel overrides everything", () => {
      process.env["OUTFITTER_ENV"] = "development";
      delete process.env["OUTFITTER_LOG_LEVEL"];

      const { server, sentMessages } = createServerWithMock();

      // Development default is debug, but client says error
      server.setLogLevel?.("error");
      server.sendLogMessage("debug", "should be filtered");
      server.sendLogMessage("error", "should pass");
      expect(sentMessages).toHaveLength(1);
    });

    it("rebind resets to computed default, not null", () => {
      process.env["OUTFITTER_ENV"] = "development";
      delete process.env["OUTFITTER_LOG_LEVEL"];

      const { server, sentMessages } = createServerWithMock();

      // Client overrides to error
      server.setLogLevel?.("error");

      // Rebind — should reset to development profile default (debug)
      const newMock = {
        sendLoggingMessage: (params: unknown) => {
          sentMessages.push(params);
          return Promise.resolve();
        },
        sendToolListChanged: () => Promise.resolve(),
        sendResourceListChanged: () => Promise.resolve(),
        sendPromptListChanged: () => Promise.resolve(),
      };
      server.bindSdkServer?.(newMock);

      server.sendLogMessage("debug", "should forward at dev default");
      expect(sentMessages).toHaveLength(1);
    });

    it("test environment defaults to no forwarding", () => {
      process.env["OUTFITTER_ENV"] = "test";
      delete process.env["OUTFITTER_LOG_LEVEL"];

      const { server, sentMessages } = createServerWithMock();

      server.sendLogMessage("error", "should not forward in test");
      expect(sentMessages).toHaveLength(0);
    });
  });
});

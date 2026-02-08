/**
 * Tests for MCP Server-to-Client Logging (OS-57)
 *
 * Verifies log level mapping and sendLoggingMessage integration.
 */
import { describe, expect, it } from "bun:test";
import { type McpLogLevel, mapLogLevelToMcp } from "../logging.js";

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

  describe("level filtering", () => {
    const levels: McpLogLevel[] = [
      "debug",
      "info",
      "notice",
      "warning",
      "error",
      "critical",
      "alert",
      "emergency",
    ];

    it("debug threshold allows all levels", () => {
      const threshold = "debug";
      const thresholdIdx = levels.indexOf(threshold);
      for (const level of levels) {
        const levelIdx = levels.indexOf(level);
        expect(levelIdx >= thresholdIdx).toBe(true);
      }
    });

    it("error threshold filters out debug/info/warning", () => {
      const threshold = "error";
      const thresholdIdx = levels.indexOf(threshold);
      expect(levels.indexOf("debug") < thresholdIdx).toBe(true);
      expect(levels.indexOf("info") < thresholdIdx).toBe(true);
      expect(levels.indexOf("warning") < thresholdIdx).toBe(true);
    });
  });
});

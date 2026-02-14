/**
 * Tests for formatDuration() and formatBytes()
 *
 * TDD RED PHASE: These tests define expected behavior for duration and byte formatting.
 */
import { describe, expect, it } from "bun:test";
import { formatBytes, formatDuration } from "../render/index.js";

// ============================================================================
// formatDuration() Tests
// ============================================================================

describe("formatDuration()", () => {
  describe("milliseconds only", () => {
    it("returns milliseconds for values under 1000", () => {
      expect(formatDuration(0)).toBe("0ms");
      expect(formatDuration(1)).toBe("1ms");
      expect(formatDuration(150)).toBe("150ms");
      expect(formatDuration(999)).toBe("999ms");
    });
  });

  describe("seconds only", () => {
    it("returns seconds for values 1000-59999ms", () => {
      expect(formatDuration(1000)).toBe("1s");
      expect(formatDuration(5000)).toBe("5s");
      expect(formatDuration(45_000)).toBe("45s");
      expect(formatDuration(59_000)).toBe("59s");
    });

    it("truncates partial seconds", () => {
      expect(formatDuration(1500)).toBe("1s");
      expect(formatDuration(5999)).toBe("5s");
    });
  });

  describe("minutes only", () => {
    it("returns minutes for values with no hours or seconds remainder", () => {
      expect(formatDuration(60_000)).toBe("1m");
      expect(formatDuration(120_000)).toBe("2m");
      expect(formatDuration(3_540_000)).toBe("59m");
    });
  });

  describe("hours only", () => {
    it("returns hours for values with no minutes or seconds remainder", () => {
      expect(formatDuration(3_600_000)).toBe("1h");
      expect(formatDuration(7_200_000)).toBe("2h");
      expect(formatDuration(36_000_000)).toBe("10h");
    });
  });

  describe("mixed durations", () => {
    it("returns hours and minutes", () => {
      expect(formatDuration(3_660_000)).toBe("1h 1m");
      expect(formatDuration(5_400_000)).toBe("1h 30m");
    });

    it("returns hours and seconds", () => {
      expect(formatDuration(3_605_000)).toBe("1h 5s");
    });

    it("returns hours, minutes, and seconds", () => {
      expect(formatDuration(9_015_000)).toBe("2h 30m 15s");
      expect(formatDuration(3_661_000)).toBe("1h 1m 1s");
    });

    it("returns minutes and seconds", () => {
      expect(formatDuration(61_000)).toBe("1m 1s");
      expect(formatDuration(90_000)).toBe("1m 30s");
    });
  });

  describe("edge cases", () => {
    it("handles exact boundaries", () => {
      expect(formatDuration(1000)).toBe("1s");
      expect(formatDuration(60_000)).toBe("1m");
      expect(formatDuration(3_600_000)).toBe("1h");
    });

    it("handles large values", () => {
      // 24 hours
      expect(formatDuration(86_400_000)).toBe("24h");
      // 100 hours
      expect(formatDuration(360_000_000)).toBe("100h");
    });
  });
});

// ============================================================================
// formatBytes() Tests
// ============================================================================

describe("formatBytes()", () => {
  describe("bytes (< 1024)", () => {
    it("returns bytes for values under 1024", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1)).toBe("1 B");
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1023)).toBe("1023 B");
    });
  });

  describe("kilobytes", () => {
    it("returns KB for values >= 1024 and < 1MB", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
      expect(formatBytes(10_240)).toBe("10 KB");
    });

    it("formats decimal places correctly", () => {
      expect(formatBytes(1126)).toBe("1.1 KB");
      expect(formatBytes(2048)).toBe("2 KB");
    });
  });

  describe("megabytes", () => {
    it("returns MB for values >= 1MB and < 1GB", () => {
      expect(formatBytes(1_048_576)).toBe("1 MB");
      expect(formatBytes(1_572_864)).toBe("1.5 MB");
      expect(formatBytes(10_485_760)).toBe("10 MB");
    });
  });

  describe("gigabytes", () => {
    it("returns GB for values >= 1GB and < 1TB", () => {
      expect(formatBytes(1_073_741_824)).toBe("1 GB");
      expect(formatBytes(1_610_612_736)).toBe("1.5 GB");
      expect(formatBytes(10_737_418_240)).toBe("10 GB");
    });
  });

  describe("terabytes", () => {
    it("returns TB for values >= 1TB", () => {
      expect(formatBytes(1_099_511_627_776)).toBe("1 TB");
      expect(formatBytes(1_649_267_441_664)).toBe("1.5 TB");
      expect(formatBytes(10_995_116_277_760)).toBe("10 TB");
    });

    it("caps at TB even for very large values", () => {
      // 1000 TB
      expect(formatBytes(1_099_511_627_776_000)).toBe("1000 TB");
    });
  });

  describe("edge cases", () => {
    it("handles exact boundary values", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1_048_576)).toBe("1 MB");
      expect(formatBytes(1_073_741_824)).toBe("1 GB");
      expect(formatBytes(1_099_511_627_776)).toBe("1 TB");
    });

    it("removes trailing .0 from formatted values", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(2048)).toBe("2 KB");
      expect(formatBytes(1_048_576)).toBe("1 MB");
    });
  });
});

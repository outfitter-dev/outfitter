/**
 * Tests for @outfitter/config/environment
 *
 * Tests cover:
 * - getEnvironment() (3 tests)
 * - getEnvironmentDefaults() (3 tests)
 *
 * Total: 6 tests
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { getEnvironment, getEnvironmentDefaults } from "../environment.js";

// ============================================================================
// getEnvironment Tests
// ============================================================================

describe("getEnvironment()", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env["OUTFITTER_ENV"];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OUTFITTER_ENV"];
    } else {
      process.env["OUTFITTER_ENV"] = originalEnv;
    }
  });

  it("returns 'production' by default", () => {
    delete process.env["OUTFITTER_ENV"];

    expect(getEnvironment()).toBe("production");
  });

  it("reads OUTFITTER_ENV when set to a valid value", () => {
    process.env["OUTFITTER_ENV"] = "development";
    expect(getEnvironment()).toBe("development");

    process.env["OUTFITTER_ENV"] = "test";
    expect(getEnvironment()).toBe("test");

    process.env["OUTFITTER_ENV"] = "production";
    expect(getEnvironment()).toBe("production");
  });

  it("ignores invalid values and falls back to production", () => {
    process.env["OUTFITTER_ENV"] = "staging";
    expect(getEnvironment()).toBe("production");

    process.env["OUTFITTER_ENV"] = "";
    expect(getEnvironment()).toBe("production");

    process.env["OUTFITTER_ENV"] = "DEVELOPMENT";
    expect(getEnvironment()).toBe("production");

    process.env["OUTFITTER_ENV"] = "dev";
    expect(getEnvironment()).toBe("production");
  });
});

// ============================================================================
// getEnvironmentDefaults Tests
// ============================================================================

describe("getEnvironmentDefaults()", () => {
  it("returns correct defaults for development", () => {
    const defaults = getEnvironmentDefaults("development");

    expect(defaults).toEqual({
      logLevel: "debug",
      verbose: true,
      errorDetail: "full",
    });
  });

  it("returns correct defaults for production", () => {
    const defaults = getEnvironmentDefaults("production");

    expect(defaults).toEqual({
      logLevel: null,
      verbose: false,
      errorDetail: "message",
    });
  });

  it("returns correct defaults for test", () => {
    const defaults = getEnvironmentDefaults("test");

    expect(defaults).toEqual({
      logLevel: null,
      verbose: false,
      errorDetail: "full",
    });
  });
});

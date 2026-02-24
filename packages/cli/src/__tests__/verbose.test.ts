/**
 * Tests for resolveVerbose() environment integration (OS-71 Phase 3)
 *
 * Verifies the precedence chain:
 * OUTFITTER_VERBOSE > explicit option > environment profile > false
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { resolveVerbose } from "../output.js";

describe("resolveVerbose()", () => {
  let originalEnv: string | undefined;
  let originalVerbose: string | undefined;

  beforeEach(() => {
    originalEnv = process.env["OUTFITTER_ENV"];
    originalVerbose = process.env["OUTFITTER_VERBOSE"];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["OUTFITTER_ENV"];
    } else {
      process.env["OUTFITTER_ENV"] = originalEnv;
    }
    if (originalVerbose === undefined) {
      delete process.env["OUTFITTER_VERBOSE"];
    } else {
      process.env["OUTFITTER_VERBOSE"] = originalVerbose;
    }
  });

  it("defaults to false in production", () => {
    delete process.env["OUTFITTER_ENV"];
    delete process.env["OUTFITTER_VERBOSE"];

    expect(resolveVerbose()).toBe(false);
  });

  it("uses explicit value when provided", () => {
    delete process.env["OUTFITTER_ENV"];
    delete process.env["OUTFITTER_VERBOSE"];

    expect(resolveVerbose(true)).toBe(true);
    expect(resolveVerbose(false)).toBe(false);
  });

  it("uses environment profile when no explicit value", () => {
    process.env["OUTFITTER_ENV"] = "development";
    delete process.env["OUTFITTER_VERBOSE"];

    expect(resolveVerbose()).toBe(true);
  });

  it("explicit value overrides environment profile", () => {
    process.env["OUTFITTER_ENV"] = "development";
    delete process.env["OUTFITTER_VERBOSE"];

    expect(resolveVerbose(false)).toBe(false);
  });

  it("OUTFITTER_VERBOSE=1 overrides explicit value", () => {
    delete process.env["OUTFITTER_ENV"];
    process.env["OUTFITTER_VERBOSE"] = "1";

    expect(resolveVerbose(false)).toBe(true);
  });

  it("OUTFITTER_VERBOSE=0 overrides environment profile", () => {
    process.env["OUTFITTER_ENV"] = "development";
    process.env["OUTFITTER_VERBOSE"] = "0";

    expect(resolveVerbose()).toBe(false);
  });

  it("ignores invalid OUTFITTER_VERBOSE values", () => {
    delete process.env["OUTFITTER_ENV"];
    process.env["OUTFITTER_VERBOSE"] = "yes";

    // Invalid value falls through to explicit or profile or default
    expect(resolveVerbose()).toBe(false);
  });

  it("test environment defaults to non-verbose", () => {
    process.env["OUTFITTER_ENV"] = "test";
    delete process.env["OUTFITTER_VERBOSE"];

    expect(resolveVerbose()).toBe(false);
  });
});

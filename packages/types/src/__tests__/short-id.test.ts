/**
 * Tests for short ID generation utilities.
 *
 * @module short-id.test
 */

import { describe, expect, it } from "bun:test";
import {
  isShortId,
  type ShortId,
  type ShortIdOptions,
  shortId,
} from "../short-id.js";

describe("shortId", () => {
  describe("shortId()", () => {
    it("returns a ShortId branded string", () => {
      const id = shortId();
      // Should be a string
      expect(typeof id).toBe("string");
      // Should be usable as ShortId
      const _typed: ShortId = id;
    });

    it("returns default length of 8 characters", () => {
      const id = shortId();
      expect(id.length).toBe(8);
    });

    it("respects custom length option", () => {
      const id = shortId({ length: 12 });
      expect(id.length).toBe(12);
    });

    it("generates unique IDs on each call", () => {
      const id1 = shortId();
      const id2 = shortId();
      const id3 = shortId();
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it("uses alphanumeric charset by default", () => {
      const id = shortId();
      // Should only contain a-z, A-Z, 0-9
      expect(id).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it("uses hex charset when specified", () => {
      const id = shortId({ charset: "hex" });
      // Should only contain 0-9, a-f
      expect(id).toMatch(/^[0-9a-f]+$/i);
    });

    it("uses base62 charset when specified", () => {
      const id = shortId({ charset: "base62" });
      // Base62 is a-z, A-Z, 0-9 (same as alphanumeric)
      expect(id).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it("prepends prefix when specified", () => {
      const id = shortId({ prefix: "usr_" });
      expect(id.startsWith("usr_")).toBe(true);
      // Total length should be prefix + default length
      expect(id.length).toBe(4 + 8);
    });

    it("combines prefix with custom length", () => {
      const id = shortId({ prefix: "id_", length: 6 });
      expect(id.startsWith("id_")).toBe(true);
      expect(id.length).toBe(3 + 6);
    });

    it("is URL-safe (no special characters)", () => {
      // Generate multiple IDs to increase confidence
      for (let i = 0; i < 10; i++) {
        const id = shortId();
        // Should not contain URL-unsafe characters
        expect(id).not.toMatch(/[^a-zA-Z0-9_-]/);
      }
    });
  });

  describe("isShortId()", () => {
    it("returns true for valid ShortId values", () => {
      const id = shortId();
      expect(isShortId(id)).toBe(true);
    });

    it("returns true for valid string matching default format", () => {
      // 8 alphanumeric characters
      expect(isShortId("a1b2c3d4")).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(isShortId("")).toBe(false);
    });

    it("returns false for string with wrong length", () => {
      // Too short
      expect(isShortId("abc")).toBe(false);
      // Too long (without options)
      expect(isShortId("a1b2c3d4e5f6")).toBe(false);
    });

    it("validates against custom length option", () => {
      const options: ShortIdOptions = { length: 12 };
      expect(isShortId("a1b2c3d4e5f6", options)).toBe(true);
      expect(isShortId("a1b2c3d4", options)).toBe(false);
    });

    it("validates prefix when specified", () => {
      const options: ShortIdOptions = { prefix: "usr_" };
      const validId = shortId(options);
      expect(isShortId(validId, options)).toBe(true);
      expect(isShortId("wrongprefix_a1b2c3d4", options)).toBe(false);
    });

    it("validates hex charset when specified", () => {
      const options: ShortIdOptions = { charset: "hex" };
      expect(isShortId("a1b2c3d4", options)).toBe(true); // Valid hex
      expect(isShortId("ghijklmn", options)).toBe(false); // Invalid hex
    });

    it("narrows type to ShortId", () => {
      const maybeId: string = "a1b2c3d4";
      if (isShortId(maybeId)) {
        // Should be narrowed to ShortId
        const _typed: ShortId = maybeId;
      }
      expect(true).toBe(true); // Compile-time test
    });
  });
});

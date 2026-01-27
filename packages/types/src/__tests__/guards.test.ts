/**
 * Tests for type guard utilities.
 *
 * @module guards.test
 */

import { describe, expect, it } from "bun:test";
import {
  assertType,
  createGuard,
  hasProperty,
  isDefined,
  isNonEmptyString,
  isPlainObject,
} from "../guards.js";

describe("guards", () => {
  describe("isDefined()", () => {
    it("returns true for defined values", () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined("")).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({})).toBe(true);
    });

    it("returns false for null", () => {
      expect(isDefined(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isDefined(undefined)).toBe(false);
    });

    it("narrows type correctly", () => {
      const value: string | null | undefined = "hello";
      if (isDefined(value)) {
        // Type should be narrowed to string
        const _str: string = value;
      }
      expect(true).toBe(true);
    });

    it("works as array filter predicate", () => {
      const items = [1, null, 2, undefined, 3];
      const defined = items.filter(isDefined);
      expect(defined).toEqual([1, 2, 3]);
    });
  });

  describe("isNonEmptyString()", () => {
    it("returns true for non-empty string", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString(" ")).toBe(true); // Whitespace is non-empty
    });

    it("returns false for empty string", () => {
      expect(isNonEmptyString("")).toBe(false);
    });

    it("returns false for non-string values", () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });

    it("narrows type to string", () => {
      const value: unknown = "test";
      if (isNonEmptyString(value)) {
        const _str: string = value;
      }
      expect(true).toBe(true);
    });
  });

  describe("isPlainObject()", () => {
    it("returns true for plain objects", () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it("returns false for null", () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it("returns false for arrays", () => {
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject([1, 2, 3])).toBe(false);
    });

    it("returns false for class instances", () => {
      class MyClass {}
      expect(isPlainObject(new MyClass())).toBe(false);
    });

    it("returns false for Date objects", () => {
      expect(isPlainObject(new Date())).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isPlainObject("string")).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
    });

    it("narrows type to Record<string, unknown>", () => {
      const value: unknown = { key: "value" };
      if (isPlainObject(value)) {
        const _obj: Record<string, unknown> = value;
      }
      expect(true).toBe(true);
    });
  });

  describe("hasProperty()", () => {
    it("returns true when property exists", () => {
      expect(hasProperty({ name: "test" }, "name")).toBe(true);
    });

    it("returns false when property is missing", () => {
      expect(hasProperty({ name: "test" }, "age")).toBe(false);
    });

    it("returns false for non-objects", () => {
      expect(hasProperty(null, "key")).toBe(false);
      expect(hasProperty("string", "length")).toBe(false);
    });

    it("narrows type to include the property", () => {
      const value: unknown = { name: "Alice", age: 30 };
      if (hasProperty(value, "name")) {
        // Type should be narrowed to Record<"name", unknown>
        const _name = value.name;
      }
      expect(true).toBe(true);
    });
  });

  describe("createGuard()", () => {
    interface User {
      name: string;
      age: number;
    }

    it("returns a type guard function", () => {
      const isUser = createGuard<User>(
        (v) =>
          isPlainObject(v) && hasProperty(v, "name") && hasProperty(v, "age")
      );
      expect(typeof isUser).toBe("function");
    });

    it("type guard returns true when predicate passes", () => {
      const isUser = createGuard<User>(
        (v) =>
          isPlainObject(v) && hasProperty(v, "name") && hasProperty(v, "age")
      );
      expect(isUser({ name: "Alice", age: 30 })).toBe(true);
    });

    it("type guard returns false when predicate fails", () => {
      const isUser = createGuard<User>(
        (v) =>
          isPlainObject(v) && hasProperty(v, "name") && hasProperty(v, "age")
      );
      expect(isUser({ name: "Alice" })).toBe(false);
      expect(isUser(null)).toBe(false);
      expect(isUser("not an object")).toBe(false);
    });

    it("type guard narrows type in conditional", () => {
      const isUser = createGuard<User>(
        (v) =>
          isPlainObject(v) && hasProperty(v, "name") && hasProperty(v, "age")
      );

      const maybeUser: unknown = { name: "Bob", age: 25 };
      if (isUser(maybeUser)) {
        // Type should be narrowed to User
        const _name: string = maybeUser.name;
        const _age: number = maybeUser.age;
      }
      expect(true).toBe(true);
    });
  });

  describe("assertType()", () => {
    interface Config {
      host: string;
      port: number;
    }

    const isConfig = createGuard<Config>(
      (v) =>
        isPlainObject(v) && hasProperty(v, "host") && hasProperty(v, "port")
    );

    it("does not throw when predicate passes", () => {
      const config: unknown = { host: "localhost", port: 3000 };
      expect(() => assertType(config, isConfig)).not.toThrow();
    });

    it("throws when predicate fails", () => {
      const invalid: unknown = { host: "localhost" };
      expect(() => assertType(invalid, isConfig)).toThrow();
    });

    it("uses custom message when provided", () => {
      const invalid: unknown = null;
      expect(() =>
        assertType(invalid, isConfig, "Expected valid config")
      ).toThrow("Expected valid config");
    });

    it("narrows type after assertion", () => {
      const config: unknown = { host: "localhost", port: 3000 };
      assertType(config, isConfig);
      // After assertion, type should be narrowed
      const _host: string = config.host;
      const _port: number = config.port;
      expect(true).toBe(true);
    });
  });
});

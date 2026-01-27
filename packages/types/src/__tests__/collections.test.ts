/**
 * Tests for collection type utilities.
 *
 * @module collections.test
 */

import { describe, expect, it } from "bun:test";
import {
  first,
  groupBy,
  isNonEmptyArray,
  last,
  type NonEmptyArray,
  toNonEmptyArray,
} from "../collections.js";

describe("collections", () => {
  describe("NonEmptyArray<T> type", () => {
    it("guarantees at least one element at type level", () => {
      // This should compile - NonEmptyArray requires at least one element
      const arr: NonEmptyArray<number> = [1];
      const _first: number = arr[0]; // Should not be undefined
      expect(arr[0]).toBe(1);
    });

    it("allows multiple elements", () => {
      const arr: NonEmptyArray<string> = ["a", "b", "c"];
      expect(arr.length).toBe(3);
    });
  });

  describe("isNonEmptyArray()", () => {
    it("returns true for array with elements", () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(["a", "b"])).toBe(true);
    });

    it("returns false for empty array", () => {
      expect(isNonEmptyArray([])).toBe(false);
    });

    it("narrows type to NonEmptyArray", () => {
      const items: number[] = [1, 2, 3];
      if (isNonEmptyArray(items)) {
        // Type should be narrowed to NonEmptyArray<number>
        const _first: number = items[0]; // Should not be number | undefined
      }
      expect(true).toBe(true);
    });

    it("works as filter predicate", () => {
      const arrays = [[], [1], [], [2, 3]];
      const nonEmpty = arrays.filter(isNonEmptyArray);
      expect(nonEmpty.length).toBe(2);
    });
  });

  describe("toNonEmptyArray()", () => {
    it("converts non-empty array to NonEmptyArray", () => {
      const input = [1, 2, 3];
      const result = toNonEmptyArray(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it("throws for empty array", () => {
      expect(() => toNonEmptyArray([])).toThrow();
    });

    it("preserves single element", () => {
      const result = toNonEmptyArray(["only"]);
      expect(result).toEqual(["only"]);
    });

    it("returns correctly typed NonEmptyArray", () => {
      const result = toNonEmptyArray([1, 2]);
      const _typed: NonEmptyArray<number> = result;
      expect(true).toBe(true);
    });
  });

  describe("first()", () => {
    it("returns first element of non-empty array", () => {
      const arr: NonEmptyArray<number> = [1, 2, 3];
      expect(first(arr)).toBe(1);
    });

    it("returns only element of single-element array", () => {
      const arr: NonEmptyArray<string> = ["only"];
      expect(first(arr)).toBe("only");
    });

    it("returns typed element (not undefined)", () => {
      const arr: NonEmptyArray<number> = [42];
      const result = first(arr);
      // Type should be number, not number | undefined
      const _num: number = result;
      expect(result).toBe(42);
    });
  });

  describe("last()", () => {
    it("returns last element of non-empty array", () => {
      const arr: NonEmptyArray<number> = [1, 2, 3];
      expect(last(arr)).toBe(3);
    });

    it("returns only element of single-element array", () => {
      const arr: NonEmptyArray<string> = ["only"];
      expect(last(arr)).toBe("only");
    });

    it("returns typed element (not undefined)", () => {
      const arr: NonEmptyArray<number> = [1, 2, 99];
      const result = last(arr);
      // Type should be number, not number | undefined
      const _num: number = result;
      expect(result).toBe(99);
    });
  });

  describe("groupBy()", () => {
    interface User {
      name: string;
      role: string;
    }

    const users: User[] = [
      { name: "Alice", role: "admin" },
      { name: "Bob", role: "user" },
      { name: "Carol", role: "admin" },
      { name: "Dave", role: "user" },
    ];

    it("groups by string key", () => {
      const byRole = groupBy(users, (u) => u.role);
      expect(byRole.get("admin")?.length).toBe(2);
      expect(byRole.get("user")?.length).toBe(2);
    });

    it("groups by computed key function", () => {
      const numbers = [1, 2, 3, 4, 5, 6];
      const byParity = groupBy(numbers, (n) => (n % 2 === 0 ? "even" : "odd"));
      expect(byParity.get("even")).toEqual([2, 4, 6]);
      expect(byParity.get("odd")).toEqual([1, 3, 5]);
    });

    it("returns Map with NonEmptyArray values", () => {
      const byRole = groupBy(users, (u) => u.role);
      expect(byRole instanceof Map).toBe(true);

      // Each group should be NonEmptyArray
      const admins = byRole.get("admin");
      if (admins) {
        const _typed: NonEmptyArray<User> = admins;
        const _first: User = admins[0]; // Should not be undefined
      }
    });

    it("handles empty array", () => {
      const result = groupBy<User, string>([], (u) => u.role);
      expect(result.size).toBe(0);
    });

    it("handles single item", () => {
      const result = groupBy([{ id: 1 }], () => "key");
      expect(result.size).toBe(1);
      expect(result.get("key")).toEqual([{ id: 1 }]);
    });

    it("preserves order within groups", () => {
      const byRole = groupBy(users, (u) => u.role);
      const admins = byRole.get("admin");
      expect(admins?.[0].name).toBe("Alice"); // First admin
      expect(admins?.[1].name).toBe("Carol"); // Second admin
    });

    it("works with number keys", () => {
      const items = [
        { value: 10, bucket: 1 },
        { value: 20, bucket: 2 },
        { value: 15, bucket: 1 },
      ];
      const byBucket = groupBy(items, (x) => x.bucket);
      expect(byBucket.get(1)?.length).toBe(2);
      expect(byBucket.get(2)?.length).toBe(1);
    });

    it("works with symbol keys", () => {
      const KEY_A = Symbol("a");
      const KEY_B = Symbol("b");
      const items = [
        { value: 1, key: KEY_A },
        { value: 2, key: KEY_B },
        { value: 3, key: KEY_A },
      ];
      const byKey = groupBy(items, (x) => x.key);
      expect(byKey.get(KEY_A)?.length).toBe(2);
      expect(byKey.get(KEY_B)?.length).toBe(1);
    });
  });
});

/**
 * Tests for collection type utilities.
 *
 * @module collections.test
 */

import { describe, expect, it } from "bun:test";
import {
  chunk,
  dedupe,
  first,
  groupBy,
  isNonEmptyArray,
  last,
  type NonEmptyArray,
  sortBy,
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

  describe("sortBy()", () => {
    interface User {
      name: string;
      age: number;
      score: number;
    }

    const users: User[] = [
      { name: "Bob", age: 30, score: 85 },
      { name: "Alice", age: 25, score: 90 },
      { name: "Alice", age: 30, score: 80 },
      { name: "Carol", age: 25, score: 95 },
    ];

    it("sorts by single criterion ascending (default)", () => {
      const result = sortBy(users, [{ key: "name" }]);
      expect(result[0].name).toBe("Alice");
      expect(result[1].name).toBe("Alice");
      expect(result[2].name).toBe("Bob");
      expect(result[3].name).toBe("Carol");
    });

    it("sorts by single criterion descending", () => {
      const result = sortBy(users, [{ key: "age", order: "desc" }]);
      expect(result[0].age).toBe(30);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(25);
      expect(result[3].age).toBe(25);
    });

    it("sorts by multiple criteria", () => {
      const result = sortBy(users, [
        { key: "name" },
        { key: "age", order: "desc" },
      ]);
      // First two should be Alice (sorted by age desc)
      expect(result[0].name).toBe("Alice");
      expect(result[0].age).toBe(30);
      expect(result[1].name).toBe("Alice");
      expect(result[1].age).toBe(25);
      // Then Bob and Carol
      expect(result[2].name).toBe("Bob");
      expect(result[3].name).toBe("Carol");
    });

    it("handles empty array", () => {
      const result = sortBy<User>([], [{ key: "name" }]);
      expect(result).toEqual([]);
    });

    it("handles empty criteria", () => {
      const result = sortBy(users, []);
      expect(result).toEqual(users);
    });

    it("does not mutate original array", () => {
      const original = [...users];
      sortBy(users, [{ key: "name" }]);
      expect(users).toEqual(original);
    });

    it("provides stable sort (preserves relative order for equal elements)", () => {
      // When two elements are equal by all criteria, their relative order should be preserved
      const items = [
        { id: 1, group: "a" },
        { id: 2, group: "b" },
        { id: 3, group: "a" },
        { id: 4, group: "b" },
      ];
      const result = sortBy(items, [{ key: "group" }]);
      // Items in group "a" should maintain relative order: id 1 before id 3
      const groupA = result.filter((x) => x.group === "a");
      expect(groupA[0].id).toBe(1);
      expect(groupA[1].id).toBe(3);
    });

    it("sorts numbers correctly", () => {
      const numbers = [{ value: 10 }, { value: 2 }, { value: 100 }];
      const result = sortBy(numbers, [{ key: "value" }]);
      expect(result.map((x) => x.value)).toEqual([2, 10, 100]);
    });

    it("sorts strings correctly", () => {
      const items = [{ name: "banana" }, { name: "apple" }, { name: "cherry" }];
      const result = sortBy(items, [{ key: "name" }]);
      expect(result.map((x) => x.name)).toEqual(["apple", "banana", "cherry"]);
    });
  });

  describe("dedupe()", () => {
    it("removes duplicates by key function", () => {
      const users = [
        { id: 1, email: "alice@example.com" },
        { id: 2, email: "bob@example.com" },
        { id: 3, email: "alice@example.com" }, // duplicate email
      ];
      const result = dedupe(users, (u) => u.email);
      expect(result.length).toBe(2);
      expect(result.map((u) => u.email)).toEqual([
        "alice@example.com",
        "bob@example.com",
      ]);
    });

    it("preserves first occurrence", () => {
      const users = [
        { id: 1, email: "alice@example.com" },
        { id: 2, email: "bob@example.com" },
        { id: 3, email: "alice@example.com" }, // should be removed, keeping id: 1
      ];
      const result = dedupe(users, (u) => u.email);
      const alice = result.find((u) => u.email === "alice@example.com");
      expect(alice?.id).toBe(1); // First occurrence preserved
    });

    it("handles empty array", () => {
      const result = dedupe<{ id: number }, number>([], (x) => x.id);
      expect(result).toEqual([]);
    });

    it("handles array with no duplicates", () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = dedupe(items, (x) => x.id);
      expect(result).toEqual(items);
    });

    it("handles all duplicates", () => {
      const items = [{ value: "same" }, { value: "same" }, { value: "same" }];
      const result = dedupe(items, (x) => x.value);
      expect(result.length).toBe(1);
    });

    it("works with primitive key values", () => {
      const numbers = [1, 2, 2, 3, 1, 4, 3];
      const result = dedupe(numbers, (n) => n);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it("works with complex key functions", () => {
      const items = [
        { firstName: "Alice", lastName: "Smith" },
        { firstName: "Bob", lastName: "Jones" },
        { firstName: "Alice", lastName: "Smith" }, // duplicate
        { firstName: "Alice", lastName: "Jones" }, // different
      ];
      const result = dedupe(items, (x) => `${x.firstName}-${x.lastName}`);
      expect(result.length).toBe(3);
    });

    it("does not mutate original array", () => {
      const original = [{ id: 1 }, { id: 1 }, { id: 2 }];
      const copy = [...original];
      dedupe(original, (x) => x.id);
      expect(original).toEqual(copy);
    });
  });

  describe("chunk()", () => {
    it("splits array into chunks of specified size", () => {
      const result = chunk([1, 2, 3, 4, 5, 6], 2);
      expect(result).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
    });

    it("handles uneven division (last chunk smaller)", () => {
      const result = chunk([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("handles size greater than array length", () => {
      const result = chunk([1, 2, 3], 10);
      expect(result).toEqual([[1, 2, 3]]);
    });

    it("handles chunk size of 1", () => {
      const result = chunk([1, 2, 3], 1);
      expect(result).toEqual([[1], [2], [3]]);
    });

    it("handles empty array", () => {
      const result = chunk<number>([], 3);
      expect(result).toEqual([]);
    });

    it("throws for chunk size less than 1", () => {
      expect(() => chunk([1, 2, 3], 0)).toThrow(
        "Chunk size must be at least 1"
      );
      expect(() => chunk([1, 2, 3], -1)).toThrow(
        "Chunk size must be at least 1"
      );
    });

    it("handles single element array", () => {
      const result = chunk([1], 5);
      expect(result).toEqual([[1]]);
    });

    it("preserves object references", () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const result = chunk([obj1, obj2], 1);
      expect(result[0][0]).toBe(obj1);
      expect(result[1][0]).toBe(obj2);
    });

    it("handles exact division", () => {
      const result = chunk([1, 2, 3, 4, 5, 6], 3);
      expect(result).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });
  });
});

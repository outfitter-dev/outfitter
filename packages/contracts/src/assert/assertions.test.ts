import { describe, expect, it } from "bun:test";
import { AssertionError } from "../errors.js";
import {
  assertDefined,
  assertMatches,
  assertNonEmpty,
  isNonEmptyArray,
} from "./index.js";

describe("isNonEmptyArray", () => {
  it("returns true for non-empty arrays", () => {
    expect(isNonEmptyArray([1, 2, 3])).toBe(true);
    expect(isNonEmptyArray(["a"])).toBe(true);
    expect(isNonEmptyArray([null])).toBe(true);
  });

  it("returns false for empty arrays", () => {
    expect(isNonEmptyArray([])).toBe(false);
  });

  it("narrows type to NonEmptyArray", () => {
    const arr: number[] = [1, 2, 3];
    if (isNonEmptyArray(arr)) {
      const first: number = arr[0];
      expect(first).toBe(1);
    }
  });
});

describe("assertDefined", () => {
  it("returns Ok for defined values", () => {
    const result = assertDefined("hello");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("hello");
    }
  });

  it("returns Ok for falsy but defined values", () => {
    expect(assertDefined(0).isOk()).toBe(true);
    expect(assertDefined("").isOk()).toBe(true);
    expect(assertDefined(false).isOk()).toBe(true);
  });

  it("returns Err for null", () => {
    const result = assertDefined(null);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AssertionError);
      expect(result.error.message).toBe("Value is null or undefined");
    }
  });

  it("returns Err for undefined", () => {
    const result = assertDefined(undefined);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AssertionError);
    }
  });

  it("uses custom message when provided", () => {
    const result = assertDefined(null, "User not found");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("User not found");
    }
  });

  it("narrows type from T | null | undefined to T", () => {
    const maybeValue: string | null | undefined = "test";
    const result = assertDefined(maybeValue);
    if (result.isOk()) {
      const value: string = result.value;
      expect(value.toUpperCase()).toBe("TEST");
    }
  });
});

describe("assertNonEmpty", () => {
  it("returns Ok with NonEmptyArray type for non-empty arrays", () => {
    const result = assertNonEmpty([1, 2, 3]);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const [first, ...rest] = result.value;
      expect(first).toBe(1);
      expect(rest).toEqual([2, 3]);
    }
  });

  it("returns Err for empty arrays", () => {
    const result = assertNonEmpty([]);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AssertionError);
      expect(result.error.message).toBe("Array is empty");
    }
  });

  it("uses custom message when provided", () => {
    const result = assertNonEmpty([], "Items required");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Items required");
    }
  });

  it("preserves element type in NonEmptyArray", () => {
    interface User {
      name: string;
    }
    const users: User[] = [{ name: "Alice" }, { name: "Bob" }];
    const result = assertNonEmpty(users);
    if (result.isOk()) {
      const firstUser: User = result.value[0];
      expect(firstUser.name).toBe("Alice");
    }
  });
});

describe("assertMatches", () => {
  it("returns Ok when predicate passes", () => {
    const result = assertMatches(42, (n) => n > 0);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(42);
    }
  });

  it("returns Err when predicate fails", () => {
    const result = assertMatches(-1, (n) => n > 0);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AssertionError);
      expect(result.error.message).toBe("Value does not match predicate");
    }
  });

  it("uses custom message when provided", () => {
    const result = assertMatches(-1, (n) => n > 0, "Number must be positive");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("Number must be positive");
    }
  });

  it("narrows type with type guard predicate", () => {
    const value: unknown = "test";
    const isString = (v: unknown): v is string => typeof v === "string";
    const result = assertMatches(value, isString);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const str: string = result.value;
      expect(str.toUpperCase()).toBe("TEST");
    }
  });

  it("narrows to subtype with type guard", () => {
    interface Animal {
      type: string;
    }
    interface Dog extends Animal {
      type: "dog";
      bark: () => string;
    }
    const isDog = (a: Animal): a is Dog => a.type === "dog";
    const animal: Animal = { type: "dog", bark: () => "woof" } as Dog;
    const result = assertMatches(animal, isDog);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const dog: Dog = result.value;
      expect(dog.bark()).toBe("woof");
    }
  });

  it("works with complex predicates", () => {
    const isValidEmail = (s: string) => s.includes("@") && s.includes(".");
    const result1 = assertMatches(
      "user@example.com",
      isValidEmail,
      "Invalid email"
    );
    expect(result1.isOk()).toBe(true);
    const result2 = assertMatches("invalid", isValidEmail, "Invalid email");
    expect(result2.isErr()).toBe(true);
  });
});

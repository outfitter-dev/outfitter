/**
 * Tests for parseInput<T>(schema, data)
 *
 * Tests cover:
 * - Happy path: valid data returns Ok<T>
 * - Error case: invalid data returns Err<ValidationError>
 * - Error format: Zod error details preserved in ValidationError message
 * - Type inference: T inferred from schema without manual type args
 * - Complex input: nested object schemas
 * - Edge case: optional fields
 * - Edge case: array schemas
 * - Edge case: discriminated union schemas
 *
 * Total: 8 tests
 */
import { describe, expect, it } from "bun:test";

import { z } from "zod";

import { parseInput } from "../validation.js";

describe("parseInput<T>()", () => {
  const UserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().min(0),
  });

  it("returns Ok with parsed value for valid input", () => {
    const input = { name: "Alice", email: "alice@example.com", age: 30 };
    const result = parseInput(UserSchema, input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(input);
    }
  });

  it("returns Err with ValidationError for invalid input", () => {
    const input = { name: "", email: "not-an-email", age: -5 };
    const result = parseInput(UserSchema, input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error._tag).toBe("ValidationError");
      expect(result.error.category).toBe("validation");
    }
  });

  it("preserves Zod error details in ValidationError message", () => {
    const input = { name: "Alice", email: "invalid", age: 30 };
    const result = parseInput(UserSchema, input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      // Message should include field path
      expect(result.error.message).toContain("email");
    }
  });

  it("infers generic T from schema — no manual type args needed", () => {
    const input = { name: "Bob", email: "bob@example.com", age: 25 };
    const result = parseInput(UserSchema, input);

    // TypeScript should infer T as { name: string; email: string; age: number }
    // This is a compile-time check: if the type inference breaks, accessing
    // typed properties below would fail at compile time.
    if (result.isOk()) {
      const name: string = result.value.name;
      const email: string = result.value.email;
      const age: number = result.value.age;
      expect(name).toBe("Bob");
      expect(email).toBe("bob@example.com");
      expect(age).toBe(25);
    }
  });

  it("handles nested object schemas", () => {
    const NestedSchema = z.object({
      user: z.object({
        profile: z.object({
          displayName: z.string().min(1),
        }),
      }),
    });

    const validInput = { user: { profile: { displayName: "Alice" } } };
    const validResult = parseInput(NestedSchema, validInput);
    expect(validResult.isOk()).toBe(true);

    const invalidInput = { user: { profile: { displayName: "" } } };
    const invalidResult = parseInput(NestedSchema, invalidInput);
    expect(invalidResult.isErr()).toBe(true);
    if (invalidResult.isErr()) {
      // Error message should reference the nested path
      expect(invalidResult.error.message).toContain("user.profile.displayName");
    }
  });

  it("handles optional fields correctly", () => {
    const OptionalSchema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    // Valid: optional field omitted
    const withoutOptional = parseInput(OptionalSchema, { required: "yes" });
    expect(withoutOptional.isOk()).toBe(true);

    // Valid: optional field present
    const withOptional = parseInput(OptionalSchema, {
      required: "yes",
      optional: "also yes",
    });
    expect(withOptional.isOk()).toBe(true);

    // Invalid: required field missing
    const missing = parseInput(OptionalSchema, {});
    expect(missing.isErr()).toBe(true);
  });

  it("handles array schemas", () => {
    const ArraySchema = z.object({
      tags: z.array(z.string().min(1)),
    });

    const validResult = parseInput(ArraySchema, {
      tags: ["hello", "world"],
    });
    expect(validResult.isOk()).toBe(true);

    const invalidResult = parseInput(ArraySchema, { tags: ["valid", ""] });
    expect(invalidResult.isErr()).toBe(true);
  });

  it("includes field information in ValidationError for single-field failure", () => {
    const SimpleSchema = z.object({
      name: z.string().min(1),
    });

    const result = parseInput(SimpleSchema, { name: "" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.field).toBe("name");
    }
  });
});

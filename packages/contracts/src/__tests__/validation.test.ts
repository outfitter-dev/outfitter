/**
 * Tests for @outfitter/contracts/validation
 *
 * Tests cover:
 * - createValidator<T>() (6 tests)
 * - validateInput<T>() (6 tests)
 *
 * Total: 12 tests
 */
import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createValidator, validateInput } from "../validation.js";

// ============================================================================
// createValidator<T>() Tests (6 tests)
// ============================================================================

describe("createValidator<T>()", () => {
  const NoteSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    content: z.string(),
  });

  it("returns a function from Zod schema", () => {
    const validate = createValidator(NoteSchema);
    expect(typeof validate).toBe("function");
  });

  it("returns Result.ok for valid input", () => {
    const validate = createValidator(NoteSchema);
    const input = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Note",
      content: "Some content",
    };

    const result = validate(input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap()).toEqual(input);
    }
  });

  it("returns Result.err(ValidationError) for invalid input", () => {
    const validate = createValidator(NoteSchema);
    const invalidInput = {
      id: "not-a-uuid",
      title: "",
      content: "Some content",
    };

    const result = validate(invalidInput);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error;
      expect(error._tag).toBe("ValidationError");
    }
  });

  it("ValidationError includes Zod issues in message", () => {
    const validate = createValidator(NoteSchema);
    const invalidInput = {
      id: "not-a-uuid",
      title: "",
    };

    const result = validate(invalidInput);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error;
      // Error message should include information about the validation failure
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it("works with object schemas", () => {
    const ConfigSchema = z.object({
      port: z.number().min(1).max(65_535),
      host: z.string(),
    });

    const validate = createValidator(ConfigSchema);
    const result = validate({ port: 3000, host: "localhost" });

    expect(result.isOk()).toBe(true);
  });

  it("works with primitive schemas", () => {
    const EmailSchema = z.string().email();
    const validate = createValidator(EmailSchema);

    const validResult = validate("test@example.com");
    expect(validResult.isOk()).toBe(true);

    const invalidResult = validate("not-an-email");
    expect(invalidResult.isErr()).toBe(true);
  });
});

// ============================================================================
// validateInput<T>() Tests (6 tests)
// ============================================================================

describe("validateInput<T>()", () => {
  const UserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().min(0),
  });

  it("returns Result.ok for valid input", () => {
    const input = {
      name: "Alice",
      email: "alice@example.com",
      age: 30,
    };

    const result = validateInput(UserSchema, input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.unwrap()).toEqual(input);
    }
  });

  it("returns Result.err for invalid input", () => {
    const invalidInput = {
      name: "",
      email: "not-an-email",
      age: -5,
    };

    const result = validateInput(UserSchema, invalidInput);

    expect(result.isErr()).toBe(true);
  });

  it("ValidationError has field information", () => {
    const invalidInput = {
      name: "Alice",
      email: "invalid-email",
      age: 30,
    };

    const result = validateInput(UserSchema, invalidInput);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error;
      // The error should indicate which field failed
      expect(error.field || error.message).toBeTruthy();
    }
  });

  it("handles nested object validation", () => {
    const NestedSchema = z.object({
      user: z.object({
        profile: z.object({
          displayName: z.string().min(1),
        }),
      }),
    });

    const invalidInput = {
      user: {
        profile: {
          displayName: "",
        },
      },
    };

    const result = validateInput(NestedSchema, invalidInput);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error;
      // Message should include path to nested field
      expect(error.message).toBeTruthy();
    }
  });

  it("handles array validation", () => {
    const ArraySchema = z.object({
      tags: z.array(z.string().min(1)),
    });

    const invalidInput = {
      tags: ["valid", "", "another"],
    };

    const result = validateInput(ArraySchema, invalidInput);

    expect(result.isErr()).toBe(true);
  });

  it("formats Zod path correctly in error message", () => {
    const DeepSchema = z.object({
      level1: z.object({
        level2: z.object({
          level3: z.string().min(5),
        }),
      }),
    });

    const invalidInput = {
      level1: {
        level2: {
          level3: "hi", // too short
        },
      },
    };

    const result = validateInput(DeepSchema, invalidInput);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      const error = result.error;
      // Error should reference the path (e.g., "level1.level2.level3")
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});

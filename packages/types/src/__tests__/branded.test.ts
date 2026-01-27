/**
 * Tests for branded type utilities.
 *
 * @module branded.test
 */

import { describe, expect, it } from "bun:test";
import {
  type Branded,
  type BrandOf,
  brand,
  type Email,
  email,
  type NonEmptyString,
  nonEmptyString,
  type PositiveInt,
  positiveInt,
  type Unbrand,
  type UUID,
  unbrand,
  uuid,
} from "../branded.js";

// Define test branded types
type NoteId = Branded<string, "NoteId">;
type FilePath = Branded<string, "FilePath">;
type UserId = Branded<string, "UserId">;

describe("branded", () => {
  describe("Type Definitions (compile-time)", () => {
    it("NoteId brand is not assignable from plain string", () => {
      // This test verifies type-level behavior
      // The @ts-expect-error should fail to error once types work correctly
      // @ts-expect-error - plain string should not be assignable to NoteId
      const _noteId: NoteId = "plain-string";
      expect(true).toBe(true); // Compile-time test
    });

    it("NoteId brand is assignable to string (covariant)", () => {
      // Branded types should be usable where the base type is expected
      const noteId = brand<string, "NoteId">("note_123");
      const _str: string = noteId; // Should compile - branded extends base
      expect(true).toBe(true); // Compile-time test
    });

    it("FilePath brand prevents cross-assignment with NoteId", () => {
      const noteId = brand<string, "NoteId">("note_123");
      // @ts-expect-error - NoteId should not be assignable to FilePath
      const _filePath: FilePath = noteId;
      expect(true).toBe(true); // Compile-time test
    });

    it("Branded type preserves underlying primitive operations", () => {
      const noteId = brand<string, "NoteId">("note_123");
      // String operations should work on branded strings
      const _upper = noteId.toUpperCase();
      const _length = noteId.length;
      expect(true).toBe(true); // Compile-time test
    });

    it("Multiple branded types remain distinct", () => {
      const userId = brand<string, "UserId">("user_1");
      const noteId = brand<string, "NoteId">("note_1");

      // @ts-expect-error - UserId should not be assignable to NoteId
      const _wrongNote: NoteId = userId;
      // @ts-expect-error - NoteId should not be assignable to UserId
      const _wrongUser: UserId = noteId;
      expect(true).toBe(true); // Compile-time test
    });

    it("Branded<T, Brand> utility works with custom brands", () => {
      type CustomBrand = Branded<number, "CustomBrand">;
      const value = brand<number, "CustomBrand">(42);
      const _custom: CustomBrand = value;
      expect(true).toBe(true); // Compile-time test
    });
  });

  describe("Brand Utilities (runtime)", () => {
    it("brand<T>() creates branded value from base type", () => {
      const noteId = brand<string, "NoteId">("note_123");
      expect(noteId).toBe("note_123");
    });

    it("unbrand<T>() extracts base value from branded type", () => {
      const noteId = brand<string, "NoteId">("note_456");
      const plain = unbrand(noteId);
      expect(plain).toBe("note_456");
      // Verify return type is string, not NoteId
      const _str: string = plain;
    });

    it("brand() and unbrand() are inverse operations", () => {
      const original = "test_value";
      const branded = brand<string, "NoteId">(original);
      const unbranded = unbrand(branded);
      expect(unbranded).toBe(original);
    });

    it("Brand symbol is not enumerable", () => {
      const noteId = brand<string, "NoteId">("note_789");
      const keys = Object.keys(noteId);
      expect(keys).not.toContain("__brand");
    });

    it("Branded values JSON.stringify correctly", () => {
      const noteId = brand<string, "NoteId">("note_json");
      const json = JSON.stringify({ id: noteId });
      expect(json).toBe('{"id":"note_json"}');
    });

    it("brand() works with number base type", () => {
      const count = brand<number, "Count">(42);
      expect(count).toBe(42);
      expect(typeof count).toBe("number");
    });
  });

  describe("Type Helpers", () => {
    it("Unbrand<T> extracts underlying type from branded type", () => {
      type Extracted = Unbrand<NoteId>;
      // This should be string
      const _value: Extracted = "plain";
      expect(true).toBe(true); // Compile-time test
    });

    it("BrandOf<T> extracts brand string from branded type", () => {
      type Brand = BrandOf<NoteId>;
      // This should be "NoteId"
      const _brand: Brand = "NoteId";
      expect(true).toBe(true); // Compile-time test
    });
  });

  describe("Validation Constructors", () => {
    describe("positiveInt", () => {
      it("returns Ok for positive integers", () => {
        const result = positiveInt(42);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe(42);
          // Verify branded type is usable
          const _positive: PositiveInt = result.value;
        }
      });

      it("returns Ok for value 1 (minimum positive)", () => {
        const result = positiveInt(1);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe(1);
        }
      });

      it("returns Err for 0", () => {
        const result = positiveInt(0);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error._tag).toBe("ValidationError");
          expect(result.error.field).toBe("value");
        }
      });

      it("returns Err for negative numbers", () => {
        const result = positiveInt(-5);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error._tag).toBe("ValidationError");
        }
      });

      it("returns Err for non-integer values", () => {
        const result = positiveInt(3.14);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error._tag).toBe("ValidationError");
        }
      });

      it("returns Err for NaN", () => {
        const result = positiveInt(Number.NaN);
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for Infinity", () => {
        const result = positiveInt(Number.POSITIVE_INFINITY);
        expect(result.isErr()).toBe(true);
      });
    });

    describe("nonEmptyString", () => {
      it("returns Ok for non-empty strings", () => {
        const result = nonEmptyString("hello");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe("hello");
          // Verify branded type is usable
          const _nonEmpty: NonEmptyString = result.value;
        }
      });

      it("returns Ok for single character", () => {
        const result = nonEmptyString("a");
        expect(result.isOk()).toBe(true);
      });

      it("returns Err for empty string", () => {
        const result = nonEmptyString("");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error._tag).toBe("ValidationError");
          expect(result.error.field).toBe("value");
        }
      });

      it("returns Err for whitespace-only string", () => {
        const result = nonEmptyString("   ");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error._tag).toBe("ValidationError");
        }
      });

      it("returns Err for tabs and newlines only", () => {
        const result = nonEmptyString("\t\n\r");
        expect(result.isErr()).toBe(true);
      });

      it("returns Ok for string with leading/trailing whitespace but content", () => {
        const result = nonEmptyString("  hello  ");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          // Value should be preserved as-is (not trimmed)
          expect(result.value).toBe("  hello  ");
        }
      });
    });

    describe("email", () => {
      it("returns Ok for valid email format", () => {
        const result = email("test@example.com");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe("test@example.com");
          // Verify branded type is usable
          const _emailValue: Email = result.value;
        }
      });

      it("returns Ok for email with subdomain", () => {
        const result = email("user@mail.example.com");
        expect(result.isOk()).toBe(true);
      });

      it("returns Ok for email with plus addressing", () => {
        const result = email("user+tag@example.com");
        expect(result.isOk()).toBe(true);
      });

      it("returns Err for string without @", () => {
        const result = email("invalid");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error._tag).toBe("ValidationError");
          expect(result.error.field).toBe("value");
        }
      });

      it("returns Err for string without domain part", () => {
        const result = email("user@");
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for string without local part", () => {
        const result = email("@example.com");
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for string without . in domain", () => {
        const result = email("user@localhost");
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for empty string", () => {
        const result = email("");
        expect(result.isErr()).toBe(true);
      });
    });

    describe("uuid", () => {
      it("returns Ok for valid UUID v4", () => {
        const result = uuid("550e8400-e29b-41d4-a716-446655440000");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value).toBe("550e8400-e29b-41d4-a716-446655440000");
          // Verify branded type is usable
          const _uuidValue: UUID = result.value;
        }
      });

      it("returns Ok for lowercase UUID", () => {
        const result = uuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
        expect(result.isOk()).toBe(true);
      });

      it("returns Ok for uppercase UUID", () => {
        const result = uuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11");
        expect(result.isOk()).toBe(true);
      });

      it("returns Err for invalid format", () => {
        const result = uuid("not-a-uuid");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error._tag).toBe("ValidationError");
          expect(result.error.field).toBe("value");
        }
      });

      it("returns Err for UUID with missing dashes", () => {
        const result = uuid("550e8400e29b41d4a716446655440000");
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for UUID with wrong length", () => {
        const result = uuid("550e8400-e29b-41d4-a716");
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for UUID with invalid characters", () => {
        const result = uuid("550e8400-e29b-41d4-a716-44665544000g");
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for empty string", () => {
        const result = uuid("");
        expect(result.isErr()).toBe(true);
      });

      it("returns Err for UUID v1 (wrong version nibble)", () => {
        // v1 UUID has '1' at version position instead of '4'
        const result = uuid("123e4567-e89b-12d3-a456-426614174000");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.message).toBe("Invalid UUID v4 format");
        }
      });

      it("returns Err for UUID with invalid variant bits", () => {
        // Valid v4 version but wrong variant (0 instead of [89ab])
        const result = uuid("550e8400-e29b-41d4-0716-446655440000");
        expect(result.isErr()).toBe(true);
      });
    });

    describe("Type Safety (compile-time)", () => {
      it("PositiveInt is not assignable from plain number", () => {
        // @ts-expect-error - plain number should not be assignable to PositiveInt
        const _positive: PositiveInt = 42;
        expect(true).toBe(true);
      });

      it("NonEmptyString is not assignable from plain string", () => {
        // @ts-expect-error - plain string should not be assignable to NonEmptyString
        const _nonEmpty: NonEmptyString = "hello";
        expect(true).toBe(true);
      });

      it("Email is not assignable from plain string", () => {
        // @ts-expect-error - plain string should not be assignable to Email
        const _email: Email = "test@example.com";
        expect(true).toBe(true);
      });

      it("UUID is not assignable from plain string", () => {
        // @ts-expect-error - plain string should not be assignable to UUID
        const _uuid: UUID = "550e8400-e29b-41d4-a716-446655440000";
        expect(true).toBe(true);
      });

      it("Different branded types are not assignable to each other", () => {
        const emailResult = email("test@example.com");
        if (emailResult.isOk()) {
          // @ts-expect-error - Email should not be assignable to UUID
          const _uuid: UUID = emailResult.value;
        }
        expect(true).toBe(true);
      });
    });
  });
});

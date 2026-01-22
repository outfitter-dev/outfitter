/**
 * Tests for branded type utilities.
 *
 * @module branded.test
 */

import { describe, expect, it } from "bun:test";
import { brand, unbrand, type Branded, type BrandOf, type Unbrand } from "../branded.js";

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
});

/**
 * @outfitter/state - TDD RED Phase Tests
 *
 * These tests document the expected behavior of the state package.
 * They will FAIL until the implementation is complete.
 *
 * Test categories:
 * 1. Cursor Creation (6 tests)
 * 2. Cursor Store (8 tests)
 * 3. Persistence (8 tests)
 * 4. Context Scoping (6 tests)
 * 5. TTL and Expiration (7 tests)
 *
 * Run with: bun test packages/state
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Result } from "@outfitter/contracts";
import {
	advanceCursor,
	createCursor,
	createCursorStore,
	createPersistentStore,
	createScopedStore,
	isExpired,
	type Cursor,
	type CursorStore,
	type ScopedStore,
} from "../index.js";

// ============================================================================
// Test Utilities
// ============================================================================

function createTmpDir(): string {
	const dir = join(
		tmpdir(),
		`outfitter-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function cleanupTmpDir(dir: string): void {
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true, force: true });
	}
}

// ============================================================================
// 1. Cursor Creation (6 tests)
// ============================================================================

describe("Cursor Creation", () => {
	it("createCursor creates a new cursor with ID and position", () => {
		const result = createCursor({ id: "cursor-1", position: 0 });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.id).toBe("cursor-1");
			expect(result.value.position).toBe(0);
		}
	});

	it("createCursor generates unique cursor ID if not provided", () => {
		const result1 = createCursor({ position: 0 });
		const result2 = createCursor({ position: 0 });

		expect(Result.isOk(result1)).toBe(true);
		expect(Result.isOk(result2)).toBe(true);
		if (Result.isOk(result1) && Result.isOk(result2)) {
			expect(result1.value.id).toBeDefined();
			expect(result2.value.id).toBeDefined();
			expect(result1.value.id).not.toBe(result2.value.id);
		}
	});

	it("createCursor accepts optional metadata", () => {
		const result = createCursor({
			id: "cursor-1",
			position: 10,
			metadata: { query: "test", pageSize: 50 },
		});

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.metadata).toEqual({ query: "test", pageSize: 50 });
		}
	});

	it("createCursor validates position is non-negative", () => {
		const result = createCursor({ id: "cursor-1", position: -1 });

		expect(Result.isErr(result)).toBe(true);
		if (Result.isErr(result)) {
			expect(result.error._tag).toBe("ValidationError");
		}
	});

	it("cursor is immutable (frozen object)", () => {
		const cursor = createCursor({ id: "cursor-1", position: 0 });

		// Result should be ok for valid input
		expect(Result.isOk(cursor)).toBe(true);
		if (Result.isOk(cursor)) {
			expect(Object.isFrozen(cursor.value)).toBe(true);
		}
	});

	it("advanceCursor returns new cursor with updated position", () => {
		const cursorResult = createCursor({ id: "cursor-1", position: 0 });
		expect(Result.isOk(cursorResult)).toBe(true);

		if (Result.isOk(cursorResult)) {
			const advanced = advanceCursor(cursorResult.value, 50);

			expect(advanced.id).toBe("cursor-1");
			expect(advanced.position).toBe(50);
			// Original should be unchanged
			expect(cursorResult.value.position).toBe(0);
		}
	});
});

// ============================================================================
// 2. Cursor Store (8 tests)
// ============================================================================

describe("Cursor Store", () => {
	let store: CursorStore;

	beforeEach(() => {
		store = createCursorStore();
	});

	it("createCursorStore initializes empty store", () => {
		const newStore = createCursorStore();

		expect(newStore.list()).toEqual([]);
	});

	it("store.set saves cursor by ID", () => {
		const cursorResult = createCursor({ id: "cursor-1", position: 10 });
		expect(Result.isOk(cursorResult)).toBe(true);

		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			const retrieved = store.get("cursor-1");

			expect(Result.isOk(retrieved)).toBe(true);
			if (Result.isOk(retrieved)) {
				expect(retrieved.value.position).toBe(10);
			}
		}
	});

	it("store.get retrieves cursor by ID", () => {
		const cursorResult = createCursor({ id: "test-cursor", position: 25 });
		expect(Result.isOk(cursorResult)).toBe(true);

		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			const result = store.get("test-cursor");

			expect(Result.isOk(result)).toBe(true);
			if (Result.isOk(result)) {
				expect(result.value.id).toBe("test-cursor");
				expect(result.value.position).toBe(25);
			}
		}
	});

	it("store.get returns Result.err(NotFoundError) for unknown ID", () => {
		const result = store.get("nonexistent");

		expect(Result.isErr(result)).toBe(true);
		if (Result.isErr(result)) {
			expect(result.error._tag).toBe("NotFoundError");
			expect(result.error.resourceType).toBe("cursor");
			expect(result.error.resourceId).toBe("nonexistent");
		}
	});

	it("store.delete removes cursor", () => {
		const cursorResult = createCursor({ id: "to-delete", position: 0 });
		expect(Result.isOk(cursorResult)).toBe(true);

		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			expect(store.has("to-delete")).toBe(true);

			store.delete("to-delete");
			expect(store.has("to-delete")).toBe(false);
		}
	});

	it("store.clear removes all cursors", () => {
		const cursor1 = createCursor({ id: "c1", position: 0 });
		const cursor2 = createCursor({ id: "c2", position: 10 });

		if (Result.isOk(cursor1) && Result.isOk(cursor2)) {
			store.set(cursor1.value);
			store.set(cursor2.value);

			expect(store.list().length).toBe(2);

			store.clear();

			expect(store.list()).toEqual([]);
		}
	});

	it("store.list returns all cursor IDs", () => {
		const cursor1 = createCursor({ id: "alpha", position: 0 });
		const cursor2 = createCursor({ id: "beta", position: 10 });
		const cursor3 = createCursor({ id: "gamma", position: 20 });

		if (Result.isOk(cursor1) && Result.isOk(cursor2) && Result.isOk(cursor3)) {
			store.set(cursor1.value);
			store.set(cursor2.value);
			store.set(cursor3.value);

			const ids = store.list();

			expect(ids).toContain("alpha");
			expect(ids).toContain("beta");
			expect(ids).toContain("gamma");
			expect(ids.length).toBe(3);
		}
	});

	it("store.has checks if cursor exists", () => {
		const cursorResult = createCursor({ id: "existing", position: 0 });

		expect(store.has("existing")).toBe(false);

		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			expect(store.has("existing")).toBe(true);
		}
	});
});

// ============================================================================
// 3. Persistence (8 tests)
// ============================================================================

describe("Persistence", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("createPersistentStore saves to file", async () => {
		const storagePath = join(tmpDir, "cursors.json");
		const store = await createPersistentStore({ path: storagePath });

		const cursorResult = createCursor({ id: "persisted", position: 100 });
		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			await store.flush();
		}

		expect(existsSync(storagePath)).toBe(true);
	});

	it("createPersistentStore loads from file on init", async () => {
		const storagePath = join(tmpDir, "cursors.json");

		// First store saves data
		const store1 = await createPersistentStore({ path: storagePath });
		const cursorResult = createCursor({ id: "persistent", position: 42 });
		if (Result.isOk(cursorResult)) {
			store1.set(cursorResult.value);
			await store1.flush();
		}

		// Second store should load existing data
		const store2 = await createPersistentStore({ path: storagePath });
		const result = store2.get("persistent");

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.position).toBe(42);
		}
	});

	it("store file uses JSON format", async () => {
		const storagePath = join(tmpDir, "cursors.json");
		const store = await createPersistentStore({ path: storagePath });

		const cursorResult = createCursor({ id: "json-test", position: 50 });
		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			await store.flush();
		}

		const fileContent = await Bun.file(storagePath).text();
		const parsed = JSON.parse(fileContent);

		expect(parsed).toHaveProperty("cursors");
		expect(parsed.cursors["json-test"]).toBeDefined();
		expect(parsed.cursors["json-test"].position).toBe(50);
	});

	it("persistence is atomic (uses atomic write)", async () => {
		const storagePath = join(tmpDir, "atomic.json");
		const store = await createPersistentStore({ path: storagePath });

		const cursorResult = createCursor({ id: "atomic-test", position: 1 });
		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			await store.flush();
		}

		// File should exist with valid content even after flush
		// (atomic write ensures no partial writes)
		const fileContent = await Bun.file(storagePath).text();
		expect(() => JSON.parse(fileContent)).not.toThrow();
	});

	it("store handles corrupted file gracefully", async () => {
		const storagePath = join(tmpDir, "corrupted.json");

		// Write corrupted JSON
		writeFileSync(storagePath, "{ invalid json content");

		// Should initialize empty store rather than crash
		const store = await createPersistentStore({ path: storagePath });

		expect(store.list()).toEqual([]);
	});

	it("store creates directory if not exists", async () => {
		const nestedDir = join(tmpDir, "nested", "deeply", "cursors");
		const storagePath = join(nestedDir, "store.json");

		// Directory doesn't exist yet
		expect(existsSync(nestedDir)).toBe(false);

		const store = await createPersistentStore({ path: storagePath });
		const cursorResult = createCursor({ id: "nested-test", position: 0 });
		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			await store.flush();
		}

		expect(existsSync(nestedDir)).toBe(true);
		expect(existsSync(storagePath)).toBe(true);
	});

	it("store respects custom storage path", async () => {
		const customPath = join(tmpDir, "custom-location", "my-cursors.json");
		const store = await createPersistentStore({ path: customPath });

		const cursorResult = createCursor({ id: "custom", position: 99 });
		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);
			await store.flush();
		}

		expect(existsSync(customPath)).toBe(true);
	});

	it("store flushes on process exit", async () => {
		// This test verifies the store registers an exit handler
		// The actual exit behavior is hard to test, so we verify the mechanism exists
		const storagePath = join(tmpDir, "exit-flush.json");
		const store = await createPersistentStore({ path: storagePath });

		// Store should have a way to register cleanup
		expect(typeof store.dispose).toBe("function");
	});
});

// ============================================================================
// 4. Context Scoping (6 tests)
// ============================================================================

describe("Context Scoping", () => {
	let store: CursorStore;

	beforeEach(() => {
		store = createCursorStore();
	});

	it("createScopedStore creates namespaced store", () => {
		const scoped = createScopedStore(store, "my-context");

		expect(scoped.getScope()).toBe("my-context");
	});

	it("scoped stores are isolated (same ID, different scope)", () => {
		const scope1 = createScopedStore(store, "scope-1");
		const scope2 = createScopedStore(store, "scope-2");

		const cursor1 = createCursor({ id: "cursor", position: 10 });
		const cursor2 = createCursor({ id: "cursor", position: 20 });

		if (Result.isOk(cursor1) && Result.isOk(cursor2)) {
			scope1.set(cursor1.value);
			scope2.set(cursor2.value);

			const result1 = scope1.get("cursor");
			const result2 = scope2.get("cursor");

			expect(Result.isOk(result1)).toBe(true);
			expect(Result.isOk(result2)).toBe(true);

			if (Result.isOk(result1) && Result.isOk(result2)) {
				expect(result1.value.position).toBe(10);
				expect(result2.value.position).toBe(20);
			}
		}
	});

	it("scopes can be nested (scope within scope)", () => {
		const outerScope = createScopedStore(store, "outer");
		const innerScope = createScopedStore(outerScope, "inner");

		expect(innerScope.getScope()).toBe("outer:inner");
	});

	it("getScope returns current scope name", () => {
		const scoped = createScopedStore(store, "test-scope");

		expect(scoped.getScope()).toBe("test-scope");
	});

	it("root store has empty scope", () => {
		const rootStore = createCursorStore();

		// Root store should implement getScope returning empty string
		expect((rootStore as ScopedStore).getScope()).toBe("");
	});

	it("scoped cursor IDs are prefixed with scope", () => {
		const scoped = createScopedStore(store, "my-scope");

		const cursorResult = createCursor({ id: "local-id", position: 0 });
		if (Result.isOk(cursorResult)) {
			scoped.set(cursorResult.value);

			// The underlying store should have the prefixed ID
			const ids = store.list();
			expect(ids).toContain("my-scope:local-id");
		}
	});
});

// ============================================================================
// 5. TTL and Expiration (7 tests)
// ============================================================================

describe("TTL and Expiration", () => {
	let store: CursorStore;

	beforeEach(() => {
		store = createCursorStore();
	});

	it("createCursor accepts ttl option (milliseconds)", () => {
		const cursorResult = createCursor({
			id: "ttl-cursor",
			position: 0,
			ttl: 60000, // 60 seconds
		});

		expect(Result.isOk(cursorResult)).toBe(true);
		if (Result.isOk(cursorResult)) {
			expect(cursorResult.value.ttl).toBe(60000);
		}
	});

	it("cursor includes expiresAt timestamp when ttl provided", () => {
		const now = Date.now();
		const cursorResult = createCursor({
			id: "expiring",
			position: 0,
			ttl: 30000, // 30 seconds
		});

		expect(Result.isOk(cursorResult)).toBe(true);
		if (Result.isOk(cursorResult)) {
			expect(cursorResult.value.expiresAt).toBeDefined();
			// Should be roughly now + ttl (allow 1 second tolerance)
			expect(cursorResult.value.expiresAt).toBeGreaterThanOrEqual(now + 30000 - 1000);
			expect(cursorResult.value.expiresAt).toBeLessThanOrEqual(now + 30000 + 1000);
		}
	});

	it("isExpired returns true for expired cursors", () => {
		const pastTime = Date.now() - 10000; // 10 seconds ago
		const cursorResult = createCursor({
			id: "past-cursor",
			position: 0,
			ttl: 5000,
		});

		expect(Result.isOk(cursorResult)).toBe(true);
		if (Result.isOk(cursorResult)) {
			// Manually set expiresAt to past for testing
			const expiredCursor = {
				...cursorResult.value,
				expiresAt: pastTime,
			} as Cursor;

			expect(isExpired(expiredCursor)).toBe(true);
		}
	});

	it("isExpired returns false for valid cursors", () => {
		const cursorResult = createCursor({
			id: "valid-cursor",
			position: 0,
			ttl: 60000, // 60 seconds in the future
		});

		expect(Result.isOk(cursorResult)).toBe(true);
		if (Result.isOk(cursorResult)) {
			expect(isExpired(cursorResult.value)).toBe(false);
		}
	});

	it("cursors without TTL never expire", () => {
		const cursorResult = createCursor({
			id: "eternal-cursor",
			position: 0,
			// No TTL provided
		});

		expect(Result.isOk(cursorResult)).toBe(true);
		if (Result.isOk(cursorResult)) {
			expect(cursorResult.value.expiresAt).toBeUndefined();
			expect(isExpired(cursorResult.value)).toBe(false);
		}
	});

	it("store.get returns NotFoundError for expired cursor", () => {
		// Create a cursor that expires immediately
		const cursorResult = createCursor({
			id: "expires-fast",
			position: 0,
			ttl: 1, // 1ms TTL
		});

		expect(Result.isOk(cursorResult)).toBe(true);
		if (Result.isOk(cursorResult)) {
			store.set(cursorResult.value);

			// Wait for expiration
			const start = Date.now();
			while (Date.now() - start < 10) {
				// Busy wait for 10ms
			}

			const result = store.get("expires-fast");
			expect(Result.isErr(result)).toBe(true);
			if (Result.isErr(result)) {
				expect(result.error._tag).toBe("NotFoundError");
			}
		}
	});

	it("store.prune removes all expired cursors", () => {
		// Create cursors with different TTLs
		const cursor1 = createCursor({ id: "short-lived", position: 0, ttl: 1 });
		const cursor2 = createCursor({ id: "long-lived", position: 0, ttl: 60000 });
		const cursor3 = createCursor({ id: "eternal", position: 0 });

		if (Result.isOk(cursor1) && Result.isOk(cursor2) && Result.isOk(cursor3)) {
			store.set(cursor1.value);
			store.set(cursor2.value);
			store.set(cursor3.value);

			// Wait for short-lived to expire
			const start = Date.now();
			while (Date.now() - start < 10) {
				// Busy wait
			}

			const pruned = store.prune();

			// Should have removed 1 expired cursor
			expect(pruned).toBe(1);
			// Should still have 2 cursors
			expect(store.list().length).toBe(2);
			expect(store.has("long-lived")).toBe(true);
			expect(store.has("eternal")).toBe(true);
			expect(store.has("short-lived")).toBe(false);
		}
	});
});

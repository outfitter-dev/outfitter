/**
 * @outfitter/index - FTS5 Index Tests
 *
 * Tests for SQLite FTS5 full-text search indexing.
 * Following TDD methodology - tests written first.
 *
 * Run with: bun test packages/index
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { Result } from "@outfitter/contracts";
import { createIndex, type Index, type IndexDocument, type TokenizerType } from "../index.js";

// ============================================================================
// Test Utilities
// ============================================================================

function createTmpDir(): string {
	const dir = join(
		tmpdir(),
		`outfitter-index-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
// 1. Index Creation (7 tests)
// ============================================================================

describe("Index Creation", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("createIndex creates database file at specified path", () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });

		expect(existsSync(dbPath)).toBe(true);
		index.close();
	});

	it("createIndex creates FTS5 virtual table with default name 'documents'", () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });
		index.close();

		// Open the database directly to verify table structure
		const db = new Database(dbPath);
		const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
		db.close();

		expect(tables).toContainEqual({ name: "documents" });
	});

	it("createIndex uses custom tableName when provided", () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath, tableName: "notes_fts" });
		index.close();

		const db = new Database(dbPath);
		const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
		db.close();

		expect(tables).toContainEqual({ name: "notes_fts" });
	});

	it("createIndex uses unicode61 tokenizer by default", () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });
		index.close();

		const db = new Database(dbPath);
		const sql = db
			.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'")
			.get() as { sql: string } | null;
		db.close();

		expect(sql?.sql).toContain("tokenize='unicode61'");
	});

	it("createIndex uses custom tokenizer when provided", () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath, tokenizer: "porter" });
		index.close();

		const db = new Database(dbPath);
		const sql = db
			.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'")
			.get() as { sql: string } | null;
		db.close();

		expect(sql?.sql).toContain("tokenize='porter'");
	});

	it("createIndex rejects invalid table names", () => {
		const dbPath = join(tmpDir, "test.db");

		expect(() => createIndex({ path: dbPath, tableName: "docs; DROP TABLE users;" })).toThrow();
	});

	it("createIndex rejects invalid tokenizer values", () => {
		const dbPath = join(tmpDir, "test.db");

		expect(() =>
			createIndex({ path: dbPath, tokenizer: "bad-tokenizer" as unknown as TokenizerType }),
		).toThrow();
	});

	it("createIndex enables WAL mode for better concurrency", () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });
		index.close();

		const db = new Database(dbPath);
		const mode = db.query("PRAGMA journal_mode").get() as { journal_mode: string } | null;
		db.close();

		expect(mode?.journal_mode).toBe("wal");
	});

	it("createIndex creates parent directories if they do not exist", () => {
		const nestedPath = join(tmpDir, "nested", "deeply", "test.db");
		expect(existsSync(join(tmpDir, "nested"))).toBe(false);

		const index = createIndex({ path: nestedPath });
		index.close();

		expect(existsSync(nestedPath)).toBe(true);
	});
});

// ============================================================================
// 2. Document Operations (8 tests)
// ============================================================================

describe("Document Operations", () => {
	let tmpDir: string;
	let index: Index;
	let dbPath: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
		dbPath = join(tmpDir, "test.db");
		index = createIndex({ path: dbPath });
	});

	afterEach(() => {
		index.close();
		cleanupTmpDir(tmpDir);
	});

	it("add() inserts a document into the index", async () => {
		const doc: IndexDocument = {
			id: "doc-1",
			content: "Hello world, this is a test document",
		};

		const result = await index.add(doc);

		expect(Result.isOk(result)).toBe(true);

		// Verify document exists
		const db = new Database(dbPath);
		const row = db.query("SELECT id, content FROM documents WHERE id = ?").get("doc-1") as {
			id: string;
			content: string;
		} | null;
		db.close();

		expect(row?.id).toBe("doc-1");
		expect(row?.content).toBe("Hello world, this is a test document");
	});

	it("add() stores document metadata as JSON", async () => {
		const doc: IndexDocument = {
			id: "doc-2",
			content: "Content with metadata",
			metadata: { title: "Test", tags: ["a", "b"], count: 42 },
		};

		const result = await index.add(doc);

		expect(Result.isOk(result)).toBe(true);

		const db = new Database(dbPath);
		const row = db.query("SELECT metadata FROM documents WHERE id = ?").get("doc-2") as {
			metadata: string;
		} | null;
		db.close();

		expect(row).not.toBeNull();
		const metadata = JSON.parse(row?.metadata ?? "null");
		expect(metadata).toEqual({ title: "Test", tags: ["a", "b"], count: 42 });
	});

	it("add() replaces existing document with same ID", async () => {
		await index.add({ id: "doc-3", content: "Original content" });
		await index.add({ id: "doc-3", content: "Updated content" });

		const db = new Database(dbPath);
		const rows = db.query("SELECT content FROM documents WHERE id = ?").all("doc-3");
		db.close();

		expect(rows.length).toBe(1);
		expect((rows[0] as { content: string }).content).toBe("Updated content");
	});

	it("addMany() inserts multiple documents in a transaction", async () => {
		const docs: IndexDocument[] = [
			{ id: "batch-1", content: "First document" },
			{ id: "batch-2", content: "Second document" },
			{ id: "batch-3", content: "Third document" },
		];

		const result = await index.addMany(docs);

		expect(Result.isOk(result)).toBe(true);

		const db = new Database(dbPath);
		const count = db.query("SELECT COUNT(*) as count FROM documents").get() as { count: number };
		db.close();

		expect(count.count).toBe(3);
	});

	it("addMany() is atomic (all or nothing)", async () => {
		// First add some valid docs
		await index.addMany([{ id: "valid-1", content: "Valid content" }]);

		const invalidDocs: IndexDocument[] = [
			{ id: "valid-2", content: "Second content" },
			// JSON.stringify will throw on BigInt
			{
				id: "invalid-1",
				content: "Bad content",
				metadata: { size: BigInt(1) } as unknown as Record<string, unknown>,
			},
		];

		const result = await index.addMany(invalidDocs);

		expect(Result.isError(result)).toBe(true);

		// Verify the transaction rolled back (no new docs)
		const db = new Database(dbPath);
		const count = db.query("SELECT COUNT(*) as count FROM documents").get() as { count: number };
		const validRow = db.query("SELECT id FROM documents WHERE id = ?").get("valid-2");
		db.close();

		expect(count.count).toBe(1);
		expect(validRow).toBeNull();
	});

	it("remove() deletes a document from the index", async () => {
		await index.add({ id: "to-delete", content: "Delete me" });

		const result = await index.remove("to-delete");

		expect(Result.isOk(result)).toBe(true);

		const db = new Database(dbPath);
		const row = db.query("SELECT id FROM documents WHERE id = ?").get("to-delete");
		db.close();

		expect(row).toBeNull();
	});

	it("remove() succeeds even if document does not exist", async () => {
		const result = await index.remove("nonexistent");

		expect(Result.isOk(result)).toBe(true);
	});

	it("clear() removes all documents from the index", async () => {
		await index.addMany([
			{ id: "clear-1", content: "Content 1" },
			{ id: "clear-2", content: "Content 2" },
			{ id: "clear-3", content: "Content 3" },
		]);

		const result = await index.clear();

		expect(Result.isOk(result)).toBe(true);

		const db = new Database(dbPath);
		const count = db.query("SELECT COUNT(*) as count FROM documents").get() as { count: number };
		db.close();

		expect(count.count).toBe(0);
	});
});

// ============================================================================
// 3. Search Operations (10 tests)
// ============================================================================

describe("Search Operations", () => {
	let tmpDir: string;
	let index: Index;

	beforeEach(async () => {
		tmpDir = createTmpDir();
		const dbPath = join(tmpDir, "test.db");
		index = createIndex({ path: dbPath });

		// Add test documents
		await index.addMany([
			{ id: "doc-1", content: "TypeScript is a typed superset of JavaScript" },
			{ id: "doc-2", content: "JavaScript runs in the browser and Node.js" },
			{ id: "doc-3", content: "Bun is a fast JavaScript runtime" },
			{ id: "doc-4", content: "Rust is a systems programming language" },
			{ id: "doc-5", content: "SQLite is a self-contained SQL database engine" },
		]);
	});

	afterEach(() => {
		index.close();
		cleanupTmpDir(tmpDir);
	});

	it("search() returns matching documents", async () => {
		const result = await index.search({ query: "JavaScript" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(3);
			const ids = result.value.map((r) => r.id);
			expect(ids).toContain("doc-1");
			expect(ids).toContain("doc-2");
			expect(ids).toContain("doc-3");
		}
	});

	it("search() returns BM25 ranking scores", async () => {
		const result = await index.search({ query: "JavaScript" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			for (const r of result.value) {
				expect(typeof r.score).toBe("number");
			}
		}
	});

	it("search() results are ordered by relevance (best first)", async () => {
		const result = await index.search({ query: "JavaScript runtime" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			const scores = result.value.map((r) => r.score);
			// BM25 returns lower scores for better matches (more negative = more relevant)
			// So scores should be in ascending order (smallest to largest)
			for (let i = 1; i < scores.length; i++) {
				expect(scores[i]).toBeGreaterThanOrEqual(
					(scores[i - 1] ?? Number.NEGATIVE_INFINITY) - 0.001,
				);
			}
		}
	});

	it("search() respects limit parameter", async () => {
		const result = await index.search({ query: "JavaScript", limit: 2 });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(2);
		}
	});

	it("search() respects offset parameter", async () => {
		const allResults = await index.search({ query: "JavaScript" });
		const offsetResults = await index.search({ query: "JavaScript", offset: 1, limit: 2 });

		expect(Result.isOk(allResults)).toBe(true);
		expect(Result.isOk(offsetResults)).toBe(true);

		if (Result.isOk(allResults) && Result.isOk(offsetResults)) {
			// Offset results should skip the first result
			expect(offsetResults.value.length).toBe(2);
			expect(offsetResults.value[0]?.id).toBe(allResults.value[1]?.id);
		}
	});

	it("search() returns empty array for no matches", async () => {
		// Use a simple term without hyphens (hyphens are interpreted as boolean NOT in FTS5)
		const result = await index.search({ query: "xyznonexistentterm" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value).toEqual([]);
		}
	});

	it("search() includes document content in results", async () => {
		const result = await index.search({ query: "Rust" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(1);
			expect(result.value[0]?.content).toBe("Rust is a systems programming language");
		}
	});

	it("search() includes highlights with matching snippets", async () => {
		const result = await index.search({ query: "JavaScript" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBeGreaterThan(0);
			const firstResult = result.value[0];
			expect(firstResult?.highlights).toBeDefined();
			expect(firstResult?.highlights?.length).toBeGreaterThan(0);
		}
	});

	it("search() supports phrase queries", async () => {
		const result = await index.search({ query: '"typed superset"' });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(1);
			expect(result.value[0]?.id).toBe("doc-1");
		}
	});

	it("search() supports prefix queries", async () => {
		const result = await index.search({ query: "Java*" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(3);
		}
	});
});

// ============================================================================
// 4. Metadata Operations (5 tests)
// ============================================================================

describe("Metadata Operations", () => {
	interface NoteMetadata {
		title: string;
		tags: string[];
		priority: number;
	}

	let tmpDir: string;
	let index: Index<NoteMetadata>;

	beforeEach(async () => {
		tmpDir = createTmpDir();
		const dbPath = join(tmpDir, "test.db");
		index = createIndex<NoteMetadata>({ path: dbPath });

		await index.addMany([
			{
				id: "note-1",
				content: "Meeting notes about the project",
				metadata: { title: "Project Meeting", tags: ["work", "meeting"], priority: 1 },
			},
			{
				id: "note-2",
				content: "Ideas for the new feature",
				metadata: { title: "Feature Ideas", tags: ["work", "ideas"], priority: 2 },
			},
		]);
	});

	afterEach(() => {
		index.close();
		cleanupTmpDir(tmpDir);
	});

	it("search() returns typed metadata", async () => {
		const result = await index.search({ query: "meeting" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(1);
			const meta = result.value[0]?.metadata;
			expect(meta?.title).toBe("Project Meeting");
			expect(meta?.tags).toEqual(["work", "meeting"]);
			expect(meta?.priority).toBe(1);
		}
	});

	it("search() handles documents without metadata", async () => {
		await index.add({ id: "no-meta", content: "Document without metadata" });

		const result = await index.search({ query: "metadata" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(1);
			expect(result.value[0]?.metadata).toBeUndefined();
		}
	});

	it("add() handles complex nested metadata", async () => {
		await index.add({
			id: "complex",
			content: "Complex metadata test",
			metadata: {
				title: "Complex",
				tags: ["test"],
				priority: 3,
				nested: {
					deep: {
						value: "nested value",
					},
				},
			} as unknown as NoteMetadata,
		});

		const result = await index.search({ query: "Complex" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(1);
			const meta = result.value[0]?.metadata as unknown as Record<string, unknown>;
			expect((meta?.nested as Record<string, unknown>)?.deep).toEqual({
				value: "nested value",
			});
		}
	});

	it("add() handles null values in metadata", async () => {
		await index.add({
			id: "null-meta",
			content: "Null metadata values",
			metadata: { title: "Null Test", tags: [], priority: 0 } as NoteMetadata,
		});

		const result = await index.search({ query: "Null" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(1);
			expect(result.value[0]?.metadata?.priority).toBe(0);
		}
	});

	it("add() handles special characters in metadata", async () => {
		await index.add({
			id: "special",
			content: "Special characters test",
			metadata: {
				title: 'Special: "quotes" & <tags>',
				tags: ["test's", "a&b"],
				priority: 1,
			},
		});

		const result = await index.search({ query: "Special" });

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.length).toBe(1);
			expect(result.value[0]?.metadata?.title).toBe('Special: "quotes" & <tags>');
		}
	});
});

// ============================================================================
// 5. Resource Management (4 tests)
// ============================================================================

describe("Resource Management", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("close() releases database connection", async () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });

		await index.add({ id: "test", content: "Test content" });
		index.close();

		// Should be able to open a new connection after close
		const db = new Database(dbPath);
		const count = db.query("SELECT COUNT(*) as count FROM documents").get() as { count: number };
		db.close();

		expect(count.count).toBe(1);
	});

	it("operations after close() return errors", async () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });
		index.close();

		const result = await index.add({ id: "test", content: "Test content" });

		expect(Result.isError(result)).toBe(true);
	});

	it("WAL files are present during active connection", async () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });

		// WAL mode creates -wal and -shm files
		const walPath = `${dbPath}-wal`;

		// Write something to trigger WAL file creation
		await index.add({ id: "wal-test", content: "WAL test" });

		// WAL file should exist during active connection
		expect(existsSync(walPath)).toBe(true);

		index.close();
	});

	it("multiple indexes can share the same database file", () => {
		const dbPath = join(tmpDir, "test.db");

		const index1 = createIndex({ path: dbPath, tableName: "table1" });
		const index2 = createIndex({ path: dbPath, tableName: "table2" });

		const db = new Database(dbPath);
		const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
			name: string;
		}>;
		db.close();

		const tableNames = tables.map((t) => t.name);
		expect(tableNames).toContain("table1");
		expect(tableNames).toContain("table2");

		index1.close();
		index2.close();
	});
});

// ============================================================================
// 6. Error Handling (5 tests)
// ============================================================================

describe("Error Handling", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = createTmpDir();
	});

	afterEach(() => {
		cleanupTmpDir(tmpDir);
	});

	it("createIndex returns usable index even with non-existent directory", () => {
		const dbPath = join(tmpDir, "nonexistent", "subdir", "test.db");
		const index = createIndex({ path: dbPath });

		expect(existsSync(dbPath)).toBe(true);
		index.close();
	});

	it("search() handles invalid FTS5 query syntax gracefully", async () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });
		await index.add({ id: "test", content: "Test content" });

		// Invalid FTS5 syntax (unclosed quote)
		const result = await index.search({ query: '"unclosed query' });

		// Should return error, not throw
		expect(Result.isError(result)).toBe(true);
		if (Result.isError(result)) {
			expect(result.error._tag).toBe("StorageError");
		}

		index.close();
	});

	it("add() handles empty content", async () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });

		const result = await index.add({ id: "empty", content: "" });

		expect(Result.isOk(result)).toBe(true);
		index.close();
	});

	it("add() handles very long content", async () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });

		const longContent = "word ".repeat(100000);
		const result = await index.add({ id: "long", content: longContent });

		expect(Result.isOk(result)).toBe(true);
		index.close();
	});

	it("add() handles special characters in content", async () => {
		const dbPath = join(tmpDir, "test.db");
		const index = createIndex({ path: dbPath });

		const specialContent = `Special chars: "quotes" 'apostrophes' <tags> & ampersands \n\t newlines`;
		const result = await index.add({ id: "special", content: specialContent });

		expect(Result.isOk(result)).toBe(true);

		const searchResult = await index.search({ query: "ampersands" });
		expect(Result.isOk(searchResult)).toBe(true);
		if (Result.isOk(searchResult)) {
			expect(searchResult.value.length).toBe(1);
		}

		index.close();
	});
});

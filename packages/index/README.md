# @outfitter/index

SQLite FTS5 full-text search indexing with WAL mode and Result-based error handling.

## Installation

```bash
bun add @outfitter/index
```

## Quick Start

```typescript
import { createIndex } from "@outfitter/index";

// Create an index
const index = createIndex({ path: "./data/search.db" });

// Add documents
await index.add({
  id: "doc-1",
  content: "Hello world, this is searchable content",
  metadata: { title: "Greeting", tags: ["hello", "world"] },
});

// Search with FTS5 syntax
const results = await index.search({ query: "hello" });

if (results.isOk()) {
  for (const result of results.value) {
    console.log(result.id, result.score, result.highlights);
  }
}

// Cleanup
index.close();
```

## Features

- **FTS5 Full-Text Search** — BM25 ranking with snippet highlights
- **WAL Mode** — Better concurrency for read-heavy workloads
- **Typed Metadata** — Generic type parameter for document metadata
- **Result-Based API** — All operations return `Result<T, StorageError>`
- **Tokenizer Options** — unicode61, porter (stemming), or trigram
- **Batch Operations** — Efficient bulk document insertion
- **Version Migration** — Built-in schema migration support

## API Reference

### createIndex(options)

Creates an FTS5 full-text search index.

```typescript
interface IndexOptions {
  path: string;                   // Path to SQLite database file
  tableName?: string;             // FTS5 table name (default: "documents")
  tokenizer?: TokenizerType;      // Tokenizer (default: "unicode61")
  tool?: string;                  // Tool identifier for metadata
  toolVersion?: string;           // Tool version for metadata
  migrations?: IndexMigrationRegistry;  // Optional migration registry
}

const index = createIndex<MyMetadata>({
  path: "./data/index.db",
  tableName: "notes_fts",
  tokenizer: "porter",
});
```

### Tokenizer Types

| Tokenizer | Use Case |
|-----------|----------|
| `unicode61` | Default, Unicode-aware word tokenization |
| `porter` | English text with stemming (finds "running" when searching "run") |
| `trigram` | Substring matching, typo tolerance |

### Index Methods

```typescript
interface Index<T = unknown> {
  // Add single document (replaces if ID exists)
  add(doc: IndexDocument): Promise<Result<void, StorageError>>;

  // Add multiple documents in a transaction
  addMany(docs: IndexDocument[]): Promise<Result<void, StorageError>>;

  // Search with FTS5 query syntax
  search(query: SearchQuery): Promise<Result<SearchResult<T>[], StorageError>>;

  // Remove document by ID
  remove(id: string): Promise<Result<void, StorageError>>;

  // Clear all documents
  clear(): Promise<Result<void, StorageError>>;

  // Close database connection
  close(): void;
}
```

### Document Structure

```typescript
interface IndexDocument {
  id: string;                           // Unique document ID
  content: string;                      // Searchable text
  metadata?: Record<string, unknown>;   // Optional metadata (stored as JSON)
}

await index.add({
  id: "note-123",
  content: "Meeting notes from standup",
  metadata: {
    title: "Standup Notes",
    date: "2024-01-15",
    tags: ["meeting", "standup"],
  },
});
```

### Search Query

```typescript
interface SearchQuery {
  query: string;    // FTS5 query string
  limit?: number;   // Max results (default: 25)
  offset?: number;  // Skip results for pagination (default: 0)
}

// Simple search
const results = await index.search({ query: "typescript" });

// Phrase search with pagination
const paged = await index.search({
  query: '"error handling"',
  limit: 10,
  offset: 20,
});
```

### FTS5 Query Syntax

FTS5 supports powerful query syntax:

| Syntax | Example | Description |
|--------|---------|-------------|
| Terms | `typescript bun` | Match all terms (implicit AND) |
| Phrase | `"error handling"` | Exact phrase match |
| OR | `ts OR typescript` | Match either term |
| NOT | `typescript NOT javascript` | Exclude term |
| Prefix | `type*` | Prefix matching |
| Grouping | `(react OR vue) AND typescript` | Complex queries |

### Search Results

```typescript
interface SearchResult<T = unknown> {
  id: string;           // Document ID
  content: string;      // Full document content
  score: number;        // BM25 relevance (negative; closer to 0 = better match)
  metadata?: T;         // Document metadata
  highlights?: string[];  // Matching snippets with <b> tags
}

const results = await index.search({ query: "hello world" });

if (results.isOk()) {
  for (const result of results.value) {
    console.log(`${result.id}: ${result.highlights?.[0]}`);
    // "doc-1: <b>Hello</b> <b>world</b>, this is..."
  }
}
```

## Batch Operations

For bulk indexing, use `addMany` for transactional efficiency:

```typescript
const documents = [
  { id: "1", content: "First document" },
  { id: "2", content: "Second document" },
  { id: "3", content: "Third document" },
];

const result = await index.addMany(documents);

if (result.isErr()) {
  // Transaction rolled back, no documents added
  console.error(result.error.message);
}
```

## Version Migration

Indexes track their schema version. Provide a migration registry for upgrades:

```typescript
import { createIndex, createMigrationRegistry } from "@outfitter/index";

const migrations = createMigrationRegistry();

migrations.register(1, 2, (ctx) => {
  ctx.db.run("ALTER TABLE documents ADD COLUMN category TEXT");
  return Result.ok(undefined);
});

const index = createIndex({
  path: "./data/index.db",
  migrations,
});
```

### Migration Registry

```typescript
interface IndexMigrationRegistry {
  register(
    fromVersion: number,
    toVersion: number,
    migrate: (ctx: IndexMigrationContext) => Result<void, StorageError>
  ): void;

  migrate(
    ctx: IndexMigrationContext,
    fromVersion: number,
    toVersion: number
  ): Result<void, StorageError>;
}

interface IndexMigrationContext {
  db: Database;  // bun:sqlite Database instance
}
```

## Index Metadata

Indexes store metadata for tracking provenance:

```typescript
interface IndexMetadata {
  version: number;      // Schema version
  created: string;      // ISO timestamp
  tool: string;         // Creating tool identifier
  toolVersion: string;  // Creating tool version
}
```

## Version Constant

The current index format version is exported for compatibility checks:

```typescript
import { INDEX_VERSION } from "@outfitter/index";

console.log(`Using index format version ${INDEX_VERSION}`);
```

## Error Handling

All operations return `Result<T, StorageError>`:

```typescript
const result = await index.add(doc);

if (result.isErr()) {
  console.error("Failed to add document:", result.error.message);
  // result.error.cause contains the underlying error
}
```

Common error scenarios:
- Index closed after `close()` called
- Invalid table name or tokenizer
- SQLite errors (disk full, permissions)
- Version mismatch without migrations

## Performance Tips

1. **Use WAL mode** — Enabled by default for better read concurrency
2. **Batch inserts** — Use `addMany` for bulk operations
3. **Choose tokenizer wisely** — `porter` for English, `unicode61` for general use
4. **Limit results** — Use pagination for large result sets
5. **Close when done** — Call `close()` to release resources

## Related Packages

- [@outfitter/contracts](../contracts/README.md) — Result types and StorageError
- [@outfitter/file-ops](../file-ops/README.md) — Path utilities and workspace detection

/**
 * Internal helpers for the FTS5 index implementation.
 *
 * Constants, validation assertions, and storage error factory used by
 * the {@link createIndex} factory function.
 *
 * @packageDocumentation
 */

import type { Database } from "bun:sqlite";

import type { StorageError } from "@outfitter/contracts";

import type { IndexMetadata, TokenizerType } from "../types.js";
import { INDEX_META_KEY, INDEX_META_TABLE } from "../version.js";

// ============================================================================
// Constants
// ============================================================================

/** Default table name for the FTS5 index */
export const DEFAULT_TABLE_NAME = "documents";

/** Default tokenizer for the FTS5 index */
export const DEFAULT_TOKENIZER: TokenizerType = "unicode61";

/** Default limit for search results */
export const DEFAULT_LIMIT = 25;

/** Default offset for search results */
export const DEFAULT_OFFSET = 0;

/** Allowed tokenizer values for SQL interpolation */
const VALID_TOKENIZERS: Record<TokenizerType, true> = {
  unicode61: true,
  porter: true,
  trigram: true,
};

/** SQLite identifier rules for table names (prevent injection) */
const TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Default tool metadata when not provided */
export const DEFAULT_TOOL = "outfitter-index";

/** Default tool version when not provided */
export const DEFAULT_TOOL_VERSION = "0.0.0";

// ============================================================================
// Validation Assertions
// ============================================================================

export function assertValidTableName(tableName: string): void {
  if (!TABLE_NAME_PATTERN.test(tableName)) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: invalid input to internal function
    throw new Error(`Invalid table name: ${tableName}`);
  }
}

export function assertValidTokenizer(tokenizer: string): TokenizerType {
  if (!Object.hasOwn(VALID_TOKENIZERS, tokenizer)) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: invalid input to internal function
    throw new Error(`Invalid tokenizer: ${tokenizer}`);
  }
  return tokenizer as TokenizerType;
}

// ============================================================================
// Storage Error Factory
// ============================================================================

/**
 * Creates a StorageError with the given message and optional cause.
 */
export function createStorageError(
  message: string,
  cause?: unknown
): StorageError {
  return {
    _tag: "StorageError",
    message,
    cause,
  };
}

// ============================================================================
// Database Metadata Helpers
// ============================================================================

export function getUserVersion(db: Database): number {
  const row = db.query("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  return row?.user_version ?? 0;
}

export function setUserVersion(db: Database, version: number): void {
  if (!Number.isInteger(version) || version < 0) {
    // oxlint-disable-next-line outfitter/no-throw-in-handler -- assertion: invalid input to internal function
    throw new Error(`Invalid user_version: ${version}`);
  }
  db.run(`PRAGMA user_version = ${version}`);
}

function ensureMetaTable(db: Database): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS ${INDEX_META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
}

export function readIndexMetadata(db: Database): IndexMetadata | null {
  try {
    const row = db
      .query(`SELECT value FROM ${INDEX_META_TABLE} WHERE key = ?`)
      .get(INDEX_META_KEY) as { value: string } | undefined;
    if (!row) {
      return null;
    }
    const parsed = JSON.parse(row.value) as IndexMetadata;
    return parsed;
  } catch {
    return null;
  }
}

export function writeIndexMetadata(
  db: Database,
  metadata: IndexMetadata
): void {
  ensureMetaTable(db);
  db.run(
    `INSERT OR REPLACE INTO ${INDEX_META_TABLE} (key, value) VALUES (?, ?)`,
    [INDEX_META_KEY, JSON.stringify(metadata)]
  );
}

/**
 * @outfitter/state
 *
 * Pagination cursor persistence and ephemeral state management.
 * Handles cursor storage, expiration, and retrieval for paginated
 * CLI and MCP workflows.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export type {
  CreateCursorOptions,
  Cursor,
  CursorStore,
  PaginationResult,
  PaginationStore,
  PersistentStore,
  PersistentStoreOptions,
  ScopedStore,
} from "./internal/types.js";

// ============================================================================
// Cursor Functions
// ============================================================================

export {
  advanceCursor,
  createCursor,
  decodeCursor,
  encodeCursor,
  isExpired,
} from "./internal/cursor.js";

// ============================================================================
// Stores
// ============================================================================

export { createCursorStore } from "./internal/cursor-store.js";
export { createPersistentStore } from "./internal/persistent-store.js";
export { createScopedStore } from "./internal/scoped-store.js";

// ============================================================================
// Pagination
// ============================================================================

export {
  createPaginationStore,
  DEFAULT_PAGE_LIMIT,
  getDefaultPaginationStore,
  loadCursor,
  paginate,
  saveCursor,
} from "./internal/pagination.js";

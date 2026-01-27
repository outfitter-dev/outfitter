/**
 * @outfitter/index
 *
 * FTS5 index types and implementation for Outfitter.
 *
 * @packageDocumentation
 */

export { createIndex } from "./fts5.js";
export {
  createMigrationRegistry,
  type IndexMigrationRegistry,
} from "./migrations.js";
export * from "./types.js";
export { INDEX_VERSION } from "./version.js";

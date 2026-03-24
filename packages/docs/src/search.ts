/**
 * Reusable FTS5-backed documentation search API.
 *
 * Wraps `@outfitter/index` to provide a high-level search interface
 * for markdown documentation. Designed with an adapter seam so the
 * underlying search backend can be swapped without changing the
 * consumer-facing API.
 *
 * @packageDocumentation
 */

export { createDocsSearch } from "./internal/docs-search.js";
export type {
  DocsSearch,
  DocsSearchConfig,
  DocsSearchDocument,
  DocsSearchIndexStats,
  DocsSearchListEntry,
  DocsSearchResult,
} from "./internal/search-types.js";

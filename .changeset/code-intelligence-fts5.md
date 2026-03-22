---
"@outfitter/docs": minor
---

Add `createDocsSearch()` API for reusable FTS5 full-text search

- `@outfitter/docs/search` — new `createDocsSearch()` factory returning an `index/search/list/get/close` handle backed by FTS5 with porter stemming, content-hash change detection, and stale-document removal

---
"@outfitter/docs": patch
---

Add optional `DocsSearchLogger` to `DocsSearchConfig` for structured warnings during hydration and indexing. Filter unresolvable IDs from search results to prevent `search()` returning IDs that `get()` cannot resolve.

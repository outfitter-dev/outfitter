---
"@outfitter/docs": minor
"outfitter": minor
---

Add qmd-powered semantic doc search and MCP server

- `@outfitter/docs`: New `createDocsSearch` API (`@outfitter/docs/search`) wrapping `@tobilu/qmd` for hybrid BM25+vector search over project documentation
- `outfitter docs index`: Assemble workspace docs to `~/.outfitter/docs/` and build search index
- `outfitter docs search`: Upgraded from basic text matching to semantic search via qmd
- `outfitter mcp start`: New MCP server exposing docs and schema tools over stdio transport

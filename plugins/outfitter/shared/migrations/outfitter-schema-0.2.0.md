---
package: "@outfitter/schema"
version: 0.2.0
breaking: false
---

# @outfitter/schema → 0.2.0

## New APIs

Initial package release for schema introspection and parity tracking:

- `generateManifest()` and manifest types
- `formatManifestMarkdown()`
- `generateSurfaceMap()`, `writeSurfaceMap()`, `readSurfaceMap()`
- `diffSurfaceMaps()`

## Migration Steps

- Add `@outfitter/schema` where you currently hand-roll action docs or parity checks.
- Use `zodToJsonSchema()` from `@outfitter/contracts` for schema conversion in manifests.

## No Action Required

- Existing handlers and transport adapters do not need changes unless adopting schema introspection.

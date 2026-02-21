---
"@outfitter/tooling": patch
---

Decouple generic bootstrap from Graphite. `CORE_TOOLS` no longer includes `gt`; use the `extend` callback to add project-specific tools. The distributed bootstrap block template no longer installs or authenticates Graphite.

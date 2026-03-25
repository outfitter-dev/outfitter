---
"@outfitter/cli": patch
---

fix(schema): `schema generate` now resolves the workspace root before writing surface files, preventing accidental writes to package-level directories

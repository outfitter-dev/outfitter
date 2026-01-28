---
"@outfitter/cli": patch
---

Replace custom `wrapText()` implementation with native `Bun.wrapAnsi()` for 33-88x faster ANSI-aware text wrapping

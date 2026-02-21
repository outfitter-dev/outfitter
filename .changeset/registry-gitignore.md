---
"@outfitter/tooling": patch
---

Stop tracking generated `registry.json` in git. The file is a build artifact
produced by `prebuild` and was causing CI failures when inputs (versions, config
files) changed between commit and build.

---
"@outfitter/cli": patch
---

Fix 4 non-blocking edge cases: tempDir validation in truncateOutput() rejects unsafe paths (relative, traversal) with graceful fallback to OS tmpdir; buildActionGraph() now recursively traverses nested subcommands in group commands; cross-feature dry-run test reads actual flag from process.argv instead of hardcoded boolean; added optional truncation config on OutputOptions for future automatic truncation support.

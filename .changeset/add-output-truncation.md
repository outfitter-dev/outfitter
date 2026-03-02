---
"@outfitter/cli": minor
---

Add output truncation with pagination hints and file pointers

- New `truncation.ts` module: `truncateOutput()` function for truncating array output with configurable `limit` and `offset`
- Without `limit`, output passes through untouched (off by default)
- When data exceeds limit: truncates to limit items with `{ showing, total, truncated: true }` metadata
- Generates pagination `CLIHint(s)` for continuation (`--offset`, `--limit`)
- For very large output (>1000 items by default), writes full result to a temp file and includes `{ full_output: path }` file pointer
- File write failures degrade gracefully (returns truncated output with warning hint, no crash)
- Structured output (JSON/JSONL) remains parseable after truncation
- File paths constrained to safe OS temp directories

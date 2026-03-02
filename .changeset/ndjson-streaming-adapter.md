---
"@outfitter/cli": minor
---

Add NDJSON streaming adapter with `--stream` flag support

- New `streaming.ts` module: `createNdjsonProgress()`, `writeNdjsonLine()`, `writeStreamEnvelope()` for writing progress events as NDJSON lines to stdout
- New `streamPreset()` flag preset in `query.ts`: adds `--stream` boolean flag
- `runHandler()` accepts `stream: true` option: emits start event, provides `ctx.progress` callback to handler, writes terminal envelope as last NDJSON line
- `--stream` is orthogonal to output mode (`--output human|json|jsonl` and env vars)
- Event ordering: start event first, progress/step events in middle, terminal envelope last

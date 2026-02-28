---
"@outfitter/cli": minor
---

Add `output.envelope()` and `runHandler()` lifecycle bridge. `createSuccessEnvelope()` and `createErrorEnvelope()` wrap command results in a structured `{ ok, command, result/error, hints? }` envelope. The `hints` field is absent (not empty array) when there are no hints. `runHandler()` bridges the full CommandBuilder lifecycle: context factory → handler invocation → Result unwrap → envelope construction → output formatting → exit code mapping. Success produces `ok: true` with result; failure produces `ok: false` with error category and message. Exit codes come from the error taxonomy `exitCodeMap`. Exported from `@outfitter/cli/envelope` subpath.

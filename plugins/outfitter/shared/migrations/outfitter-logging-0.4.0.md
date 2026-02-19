---
package: "@outfitter/logging"
version: 0.4.0
breaking: false
---

# @outfitter/logging → 0.4.0

## New APIs

- `resolveLogLevel()` accepts `string` and is runtime-safe in edge/V8 contexts.
- `createConsoleSink()` supports a `formatter` option.
- `LoggerInstance` now explicitly extends contracts `Logger`.

## Migration Steps

- If you passed narrow log-level types, broaden to `string | LogLevel` where needed.
- Optionally supply a formatter in console sink setup for custom output.

## No Action Required

- Existing logger creation and usage patterns continue to work.

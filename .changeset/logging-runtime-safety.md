---
"@outfitter/logging": minor
---

Runtime-safe log level resolution, console sink formatter option, and type improvements.

- **fix**: `resolveLogLevel()` is now runtime-safe for edge/V8 environments and accepts `string` input (#337)
- **feat**: `LoggerInstance` explicitly extends `Logger` from contracts (#338)
- **feat**: `createConsoleSink()` accepts a `formatter` option for custom output formatting (#339)
- **chore**: Convert cross-package deps to peerDependencies (#344)

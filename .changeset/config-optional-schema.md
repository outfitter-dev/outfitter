---
"@outfitter/config": minor
---

Make `loadConfig()` schema parameter optional with TypeScript overloads. Without schema, returns raw parsed config as `Result<unknown, ...>` (unvalidated). With schema, returns validated typed config as `Result<T, ...>` (backward compatible). Overloads narrow the return type correctly: `loadConfig(appName)` → `Result<unknown>`, `loadConfig(appName, schema)` → `Result<T>`.

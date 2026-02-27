---
"@outfitter/cli": minor
---

Add `.context(factory)` method to `CommandBuilder` for async context construction. The factory receives typed `TInput` (post-schema validation from `.input()`) or raw parsed flags (when `.input()` is not used) and returns a typed context object. The context is passed to the `.action()` handler alongside input via `ctx`. Context factory errors are caught and produce proper exit codes using the error taxonomy. Generic `TContext` type flows through `CommandBuilder` to the action handler for full type safety.

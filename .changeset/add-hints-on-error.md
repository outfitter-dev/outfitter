---
"@outfitter/cli": minor
---

Add `.hints(fn)` and `.onError(fn)` to CommandBuilder for transport-local hint declarations. Success hint function receives `(result, input)` and error hint function receives `(error, input)`, both returning `CLIHint[]`. Handlers remain transport-agnostic — hint functions are stored on the builder and invoked at output time by `runHandler()`.

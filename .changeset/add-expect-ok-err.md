---
"@outfitter/contracts": minor
---

Add `expectOk(result)` and `expectErr(result)` test assertion helpers. `expectOk` asserts a Result is Ok and returns the narrowed `T` value; throws a descriptive error if Err. `expectErr` does the inverse — asserts Err and returns narrowed `E`. Both accept an optional message parameter and work with Bun's test runner.

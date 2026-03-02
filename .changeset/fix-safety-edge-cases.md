---
"@outfitter/cli": patch
---

Fix 3 safety edge cases: (1) `.destructive()` is now order-agnostic with `.action()` — flag application deferred to `.build()` time. (2) `buildDryRunHint()` strips `--dry-run=true` and `--dry-run=<value>` variants. (3) `createErrorEnvelope()` only includes `retry_after` for `rate_limit` errors (defense-in-depth guard).

---
"@outfitter/cli": minor
---

Surface `retryable` and `retry_after` in error envelopes. Error envelopes now include `retryable: boolean` derived from `errorCategoryMeta()`, indicating whether the error is transient and safe to retry. For `rate_limit` errors with `retryAfterSeconds`, the envelope also includes `retry_after` in seconds. Non-delay errors omit `retry_after`.

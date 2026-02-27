---
"@outfitter/contracts": minor
---

Add `fromFetch(response)` helper that converts an HTTP Response into a `Result<Response, OutfitterError>`. Maps HTTP status codes to error categories per the taxonomy: 2xx → Ok, 404 → not_found, 401 → auth, 429 → rate_limit, 403 → permission, 408/504 → timeout, 502/503 → network, 409 → conflict, other 5xx → internal.

---
"@outfitter/cli": patch
---

Replace raw JSON.stringify with safeStringify in NDJSON streaming and error envelope serialization paths for consistent BigInt handling, circular reference detection, and sensitive data redaction

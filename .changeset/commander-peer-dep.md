---
"@outfitter/cli": patch
---

Move `commander` from `dependencies` to `peerDependencies` with `>=14.0.0`. Consumers must now provide their own `commander` installation.

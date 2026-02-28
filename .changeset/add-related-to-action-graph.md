---
"@outfitter/cli": minor
---

Add `.relatedTo(target, options?)` to `CommandBuilder` for declaring relationships between commands. Declarations build a navigable action graph (tier-4 hints). `buildActionGraph()` constructs graph nodes (commands) and edges (relationships) from a Commander program. `graphSuccessHints()` generates next-action hints from graph neighbors for success envelopes. `graphErrorHints()` generates remediation-path hints for error envelopes. Unknown targets produce warnings (not crashes), self-links and cycles are handled safely.

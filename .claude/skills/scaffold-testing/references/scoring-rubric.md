# Scoring Rubric

Behavioral anchors for each scoring dimension. Scores are 1-10 integers.

## Agent Readiness

How well can an AI agent set up and use this scaffolded project without human intervention?

| Score | Anchor                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Needs manual intervention. Undocumented steps required. No CLAUDE.md or AGENTS.md. Agent would fail to build or test without guessing.         |
| 4-6   | Completes with minor workarounds. Most steps documented in README. CLAUDE.md exists but incomplete. Agent needs to infer some steps.           |
| 7-9   | Zero intervention needed. All steps in README and CLAUDE.md/AGENTS.md. Commands section covers build, test, lint. Handler patterns documented. |
| 10    | Perfect agent experience. Progressive disclosure, hint system, error recovery guidance, related commands documented.                           |

**Evidence to cite**: Presence/content of CLAUDE.md, AGENTS.md, README commands section, package.json scripts.

## Documentation Completeness

Does the scaffold produce documentation sufficient for a new developer?

| Score | Anchor                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Missing README or README lacks setup instructions. No inline code comments. Package.json missing description/keywords. |
| 4-6   | README covers basic setup (install, build, test). Package.json has metadata. Missing configuration docs or edge cases. |
| 7-9   | README + CLAUDE.md cover setup, config, development workflow, and troubleshooting. TSDoc on exported functions.        |
| 10    | Comprehensive: README, CLAUDE.md, inline docs, architecture overview, example usage, FAQ.                              |

**Evidence to cite**: README.md sections, CLAUDE.md content, package.json metadata, TSDoc presence in source files.

## Error Clarity

How clear and actionable are error messages when things go wrong?

| Score | Anchor                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Generic error strings (`throw new Error("failed")`). No error categories. Stack traces as user-facing output.       |
| 4-6   | Result types used but messages are vague. Error categories present but not consistently applied.                    |
| 7-9   | Typed errors with categories from @outfitter/contracts. Actionable messages with context. Hints on error envelopes. |
| 10    | Full error taxonomy, retryable flags, recovery hints, related command suggestions, machine-parseable error output.  |

**Evidence to cite**: Handler return types, error construction patterns, use of OutfitterError, error envelope structure.

## Setup Friction

How much effort to go from `outfitter init` to a working, tested project?

| Score | Anchor                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Multiple manual steps after scaffold. Fails on first `bun install` or `bun run build`. Missing dependencies or configs. |
| 4-6   | Works on first run but requires reading README to understand the build step. Some scripts missing from package.json.    |
| 7-9   | Single command flow: init -> install -> build -> test all pass without reading docs. verify:ci covers everything.       |
| 10    | Zero friction. Init with install, build and test pass immediately. Progressive disclosure for advanced config.          |

**Evidence to cite**: Phase results (did install/build/verify pass?), package.json scripts, number of manual steps needed.

## Type Correctness

How well does the scaffolded code leverage TypeScript's type system?

| Score | Anchor                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| 1-3   | Uses `any`, loose types, no strict mode in tsconfig. Missing type annotations on exports.                                  |
| 4-6   | Strict mode enabled. Occasional `as` casts. Types present but not leveraging Result types or branded types.                |
| 7-9   | Fully strict, no `any`, no unsafe casts. Result types for handlers. Zod schemas for validation at boundaries.              |
| 10    | Exemplary: strict mode, Result types, branded types, Zod validation, exactOptionalPropertyTypes, noUncheckedIndexedAccess. |

**Evidence to cite**: tsconfig.json settings, presence of `any`/`as` in source, Result type usage, Zod schema presence.

## Overall

Weighted average of all dimensions:

| Dimension                  | Weight |
| -------------------------- | ------ |
| Agent Readiness            | 25%    |
| Setup Friction             | 25%    |
| Documentation Completeness | 20%    |
| Error Clarity              | 15%    |
| Type Correctness           | 15%    |

Formula: `round(readiness * 0.25 + friction * 0.25 + docs * 0.20 + errors * 0.15 + types * 0.15)`

The reasoning for Overall should state the weighted calculation and highlight the strongest and weakest dimensions.

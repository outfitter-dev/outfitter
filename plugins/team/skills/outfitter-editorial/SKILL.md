---
name: outfitter-editorial
description: "Complete editorial review for Outfitter documentation — voice, style, correctness, and completeness. Use when reviewing docs, auditing before merge, or checking content quality."
context: fork
agent: editor
metadata:
  version: "2.0.0"
  author: outfitter
  category: documentation
---

# Editorial Review

Complete editorial pass for Outfitter documentation — covering voice, style, correctness, and completeness in a single skill.

## Steps

1. **Load skills**: Load the `outfitter-voice` and `outfitter-styleguide` skills. If you cannot, do not proceed — report the failure.
2. **Identify target**: $ARGUMENTS — can be:
   - A file path (`README.md`, `docs/ARCHITECTURE.md`)
   - A directory (`docs/`)
   - A focus area (`voice`, `correctness`, `code examples`)
   - A specific question (`are all links valid?`)
   - Empty — review the most relevant doc in the current context
3. **Voice**: Verify Outfitter voice (see `outfitter-voice` skill): confident stance, agent-first framing, plain language over jargon.
4. **Style**: Verify craft patterns (see `outfitter-styleguide` skill): punch-and-flow rhythm, earned enthusiasm, strong opening and closing.
5. **Technical checks**: Work through the verification checklist below.
6. **Report**: Structured output per [TEMPLATE.md](TEMPLATE.md). If the document is ready, say so briefly. If it needs work, be specific about locations and fixes.

## Verification Checklist

Work through each dimension. For each item, document: PASS/FAIL + evidence.

### Correctness (accuracy)

| Check | How to Verify |
|-------|---------------|
| Code examples run | Extract and execute each example. Report errors verbatim. |
| API signatures match | Compare documented signatures against source code. |
| Links resolve | Check each link target exists (relative paths, anchors, URLs). |
| Technical claims accurate | Cross-reference against implementation or authoritative source. |
| Versions current | Verify version numbers match package.json, Cargo.toml, etc. |

### Completeness (nothing missing)

| Check | How to Verify |
|-------|---------------|
| Required sections present | Compare against applicable template (README, API ref, guide). |
| Parameters documented | Each param has: type, purpose, constraints, default value. |
| Error scenarios covered | Document what happens when things go wrong. |
| Edge cases addressed | Empty inputs, nulls, boundaries, concurrent access. |
| Success and failure examples | Show both happy path and error handling. |

### Comprehensiveness (depth)

| Check | How to Verify |
|-------|---------------|
| Common use cases | List 3-5 typical scenarios; verify each is addressed. |
| Migration paths | Breaking changes include upgrade instructions. |
| Cross-references | Related docs linked where helpful. |
| Agent-friendly | Structured for AI consumption (clear headers, examples). |
| Troubleshooting | Common issues and solutions documented. |

## Output

Use the report structure in [TEMPLATE.md](TEMPLATE.md).


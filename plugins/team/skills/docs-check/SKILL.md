---
name: docs-check
description: "Quality gate for documentation before merge or publish — verifies code examples, links, and API accuracy. Use when auditing docs or reviewing documentation PRs."
context: fork
agent: editor
metadata:
  version: "1.0.0"
  author: outfitter
  category: documentation
---

# Documentation Check

Rigorous quality gate for documentation. Focused on correctness, completeness, and comprehensiveness — not just voice and style.

## Usage

```
/docs-check [focus]
```

### Examples

```
/docs-check                              # Full quality gate
/docs-check focus on code examples       # Verify examples run
/docs-check check API completeness       # Parameter coverage
/docs-check are all links valid?         # Link check
/docs-check just the Quick Start         # Section-specific
```

## Arguments

**Focus**: $ARGUMENTS

Use arguments to narrow the scope:

| Argument Type | Example | Behavior |
|---------------|---------|----------|
| Section name | `just the Quick Start` | Audit only that section |
| Quality dimension | `focus on correctness` | Prioritize that checklist |
| Specific question | `are the code examples runnable?` | Answer directly with evidence |
| None provided | (empty) | Run full checklist across all dimensions |

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

## Execution

1. **Identify target** — What documentation is being checked?
2. **Run checks** — Work through the checklist, executing verification steps
3. **Collect evidence** — Note specific line numbers, error messages, missing items
4. **Classify issues** — Blocking (must fix) vs. suggestions (nice to have)
5. **Report** — Structured output per format below

## Output Format

Use the report structure in [TEMPLATE.md](TEMPLATE.md).

## When to Use

- Before merging documentation PRs
- Before publishing READMEs to new packages
- Quarterly documentation audits
- After major feature changes

## Relationship with docs-review

For combined voice/style and technical verification, load both this skill and the `docs-review` skill.

| Dimension | docs-review | docs-check |
|-----------|-------------|------------|
| **Focus** | Voice, style, structure | Correctness, completeness |
| **Question** | "Does it sound right?" | "Is it accurate and complete?" |
| **Approach** | Subjective assessment | Objective verification |
| **Output** | Editorial feedback | Pass/fail with evidence |
| **Speed** | Quick pass | Thorough audit |

**When to use each:**

- **docs-review** — Polishing prose, checking tone, improving flow
- **docs-check** — Quality gate before merge, verifying technical accuracy
- **Both** — Full documentation audit (load both skills)

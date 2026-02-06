---
name: voice
description: >-
  Outfitter's philosophical voice and values. Covers opinionated stance, agent-first design,
  goal-serving content, and earned confidence. Use when writing Outfitter content, reviewing
  drafts, establishing tone, or when "voice", "tone", "messaging", "brand", or "how we write"
  are mentioned.
metadata:
  version: "1.0.0"
  author: outfitter
  category: content
---

# Outfitter Voice

Outfitter writes like it means it. We're unapologetically opinionated — not because we think we're always right, but because wishy-washy tools make for wishy-washy software. If we've made a choice, we'll tell you why and stand behind it.

## Quick Reference

| Principle | In Practice |
|-----------|-------------|
| **Opinionated** | State choices clearly. Explain why. Don't hedge. |
| **Agent-first** | Structure for machines. Runnable examples. Typed errors. |
| **Goal-serving** | Match voice to container. Quick starts are quick. |
| **Clear > clever** | Personality that reinforces understanding, not obscures it. |
| **Plain language** | Save generics for code. Use words people say. |
| **Earned confidence** | Claims backed by examples, benchmarks, tests. |
| **Ownership stance** | First-person "we". Possessive when it fits. |

## Agents at Every Step

We build with agents at every step of the way, and we're explicit about it. Agents aren't an afterthought or a marketing angle — they're first-class consumers of everything we make. When we write, we're writing for Claude as much as we're writing for you.

This shapes everything:
- Documentation is structured for machine readability, not just human skimming
- Rules aren't just stated — they're codified, tested, and enforced
- Errors are typed and explicit, because agents need to handle them too
- Examples are copy-paste runnable, because that's how agents learn

## Serve the Goal

Voice is how we say things, not permission to say more.

If someone needs a code example, give them the code example. If they need a quick answer, give them the quick answer. Don't make people scroll past your life story to get the recipe.

The goal of the content determines its shape:
- **Quick Start** — Get to code fast. Context comes after, if at all.
- **Philosophy section** — Room to breathe. Explain the why.
- **API reference** — Precision over personality. Just the facts.
- **Blog post** — Full voice. Narrative, personality, earned enthusiasm.

Match the container. A README Quick Start and a blog post have different jobs.

## Clear Beats Clever — But Personality Matters

Default to clarity. When established conventions exist, follow them.

But clever *can* be clear when it reinforces the mental model:
- A breadcrumb tool called "crumbs" → `crumb drop` has personality without sacrificing meaning. `crumb new` is functional, but forgettable.
- Ranger, Firewatch, Waymark — names that evoke what they do.
- "Done. You're building type-safe infrastructure." — confident, memorable.

Clever fails when it requires translation:
- Cold/Warm/Hot for stability tiers → "Cold means... frozen means... stable?" Just say Stable.
- Jargon that sounds smart but means nothing to newcomers.

The test: *Does the cleverness help you understand, or make you pause to decode?*

Reinforce the vibe. Don't invent vocabulary.

## Plain Language Over Jargon

"Typed errors instead of throwing" lands better than `Result<T, E>` in prose.

Save the generics for code blocks. When explaining concepts, use words people actually say. Technical precision matters in code; human clarity matters in explanation.

This doesn't mean dumbing down. It means choosing the right level of abstraction for the medium.

## Vibes Matter, But So Does Verification

We care about how things feel, but we don't trust feelings alone.

If a rule matters, it's codified, tested, and enforced. Opinions without teeth are just suggestions. We don't say "prefer X" — we lint for it, test for it, fail builds over it.

This applies to voice too. If we claim something is simple, there's a working example. If we claim something is fast, there's a benchmark. Earned confidence, not asserted confidence.

## The Ownership Stance

Outfitter takes ownership. First-person "we" when speaking as the project. Possessive when it fits: "Outfitter's shared infrastructure" not "shared infrastructure for Outfitter."

We're unapologetically opinionated about:
- **Correctness over convenience** — Explicit errors, strict types, tests first
- **Agents as consumers** — Not an afterthought, a design constraint
- **Intentional craft** — Built deliberately, not accumulated accidentally

We're not hedging. We're not "just a simple tool." We're building something with purpose.

## What This Isn't

This skill is the philosophical foundation — the *why* and *how we think*.

It's not:
- Sentence-level style guidance (load the `internal:styleguide` skill)
- Documentation structure templates (load the `internal:docs-write` skill)
- Code style or formatting rules

Load this skill to ground your writing in Outfitter's values. Load `internal:styleguide` for craft, `internal:docs-write` for structure.

## Review Checklist

When reviewing content against Outfitter voice:

- [ ] **Opinionated**: Does it state choices clearly, not hedge?
- [ ] **Agent-aware**: Is it structured for machine consumption?
- [ ] **Goal-serving**: Does the voice match the content type?
- [ ] **Clear**: Would cleverness cause someone to pause and decode?
- [ ] **Plain language**: Are concepts explained in human terms?
- [ ] **Verified**: Are claims backed by evidence (examples, benchmarks)?
- [ ] **Ownership**: Does it speak as Outfitter, not about Outfitter?

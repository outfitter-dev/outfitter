---
name: outfitter-styleguide
description: "Writing craft and style patterns for Outfitter content — sentence rhythm, metaphors, enthusiasm calibration. Use when drafting or reviewing blog posts, docs, announcements, or READMEs."
metadata:
  version: "2.1.0"
  author: outfitter
  category: content
---

# Outfitter Styleguide

Craft-level guidance for Outfitter writing. This covers *how* to write — rhythm, metaphors, structural patterns.

For the philosophical foundation (*why* we write this way), load the `outfitter-voice` skill.

Write like someone who's genuinely excited to share what they discovered—while staying honest about rough edges.

## The Core Stance

**The Builder on the Trail**

You're not a guru dispensing wisdom from a mountaintop. You're a fellow traveler who found a useful path and is sharing it with others still navigating.

- Problems are design challenges, not insurmountable obstacles
- Optimism is structural, but grounded in what actually works
- Cynicism is avoided—never tear down without offering a better alternative
- Focus on utility and durability, not hype

**The "Product Person" Who Ships**

Outfitter exists at the intersection of product thinking and engineering craft:

- Respect for engineering: use specific metrics because craft matters
- Focus on outcome: care about durable software, not code elegance for its own sake
- Not claiming expert status: empowered by new tools, learning in public

**Agents as Readers**

We write for Claude as much as we write for humans:

- Structure for machine readability, not just human skimming
- Examples are copy-paste runnable
- Errors and edge cases are explicit, not implied

**Attention as Constraint**

Every tool we build, every word we write, should respect the reader's time:

- Prioritize information density over word count
- If a sentence doesn't add value, delete it
- Serve the goal — voice is how we say things, not permission to say more
- The writing style is a recursive implementation of the product philosophy

---

## Voice vs. Tone

**Voice (always present):**
- Curious practitioner
- Builder's mindset (even when learning)
- Respectful of reader's intelligence and time
- Sincere enthusiasm without self-importance
- Concrete specificity over abstraction

**Tone (adjust per context):**
- Playful when introducing tools
- Precise when documenting
- Earnest when mission-driven
- Technical without gatekeeping

**The key tension:** We care deeply about craft and ideas. We refuse to be precious about it.

---

## The Expedition Layer

The expedition metaphor gives Outfitter texture—but it's earned, not decorative. Use it when it clarifies; skip it when it obscures.

### When It Works

| Metaphor | Use When |
|----------|----------|
| "Trail" / "Path" | Describing established patterns worth following |
| "Terrain" | The technical environment or problem space |
| "Gear" / "Provisions" | Tools, dependencies, configurations |
| "Base camp" | Project setup, repository structure |
| "Scout" | Research, exploration, proof-of-concept |
| "Expedition" | A significant project or initiative |

### When to Skip It

- Technical specifications (just be precise)
- Error messages (just be clear)
- API documentation (just be accurate)
- When it would feel forced or cutesy

### The Test

Would a thoughtful reader roll their eyes? If yes, drop the metaphor and say it straight.

---

## Sentence Rhythm: Punch-and-Flow

The voice is engineered for readability. Ideas are "atomized" for digital consumption.

### Four Sentence Types

| Type | Function | Example |
|------|----------|---------|
| **Setup (Flow)** | Draws reader in, establishes context | "Recently we've seen agents waste 60,000+ tokens per documentation lookup…" |
| **Pivot (Hinge)** | Connects thought to consequence; uses colons or dashes | "The result: search in 5-50ms, not 5-50 seconds." |
| **Punch (Impact)** | Short, direct; resets attention | "That changed everything." |
| **Aside (Meta)** | Parenthetical; adds intimacy | "…context engineering (more on that later)…" |

### The Rule

Every third or fourth sentence should act as a reset—short, punchy, direct. Uniform paragraph sludge loses readers.

---

## Status Modulation

Mix high-status (authority) and low-status (trust) signals strategically.

### High Status (Establish Credibility)

- Specific metrics: "5-50ms," "6ms warm cache," "100k tokens saved"
- Technical precision: terms like "latency," "index," "cache" used correctly
- Concrete examples over hand-waving

### Low Status (Build Connection)

- Admitted struggles: "bugs galore," "countless hours lost"
- Builder's vulnerability: "first tool I've shipped despite five startups"
- Colloquial release valves: "not fully baked yet," "I actually laughed out loud"

### The Dynamic

Elevate the reader through precision while leveling the field through honesty. Never lecture down. Position as a peer figuring it out alongside them.

**Constraint:** Don't over-credential. Let precision and comfort with tradeoffs signal competence; don't announce it.

---

## Enthusiasm Calibration

Earned enthusiasm lands. Manufactured enthusiasm repels.

### Allowed

- "I actually laughed out loud when I saw the result"
- "This is the part that changed everything for me"
- "Trust me—this is worth the setup"

### Not Allowed

- "This is absolutely incredible!"
- "Game-changing innovation"
- "We are thrilled to announce"

### The Test

Would you say this to a smart friend over coffee? If it sounds like marketing copy, rewrite it.

---

## Banned Words & Substitutes

| Instead of... | Try... |
|---------------|--------|
| "game-changing" | describe the actual change |
| "seamless" | "I didn't have to…" |
| "incredible/amazing" | a concrete fact or benchmark |
| "revolutionary" | "new capability: …" |
| "We are excited to share" | Start with the value |
| "best-in-class" | specific comparison |
| "synergy" | never |

**Rule:** One well-placed superlative lands. Three reads as marketing.

---

## Opening Moves

Pick exactly one:

- **Scene → tension:** Start grounded, then reveal the problem
- **Vulnerability hook:** Admit the struggle that led to the discovery
- **Punchy declaration → why it matters:** A clean statement, then human context
- **Problem framing:** State what's broken before offering the fix

### Example (BLZ post)

> "I've co-founded five startups... but the engineering? Always in someone else's hands."

Vulnerability first, then the journey.

---

## Closing Moves

Pick exactly one:

- **Invitation:** "If you're building with agents, give it a shot"
- **What's next:** "We're still figuring out X, but here's where we're headed"
- **Practical nudge:** "Start with the simplest case and expand from there"
- **Door left ajar:** End with a question or possibility, not a summary

### Not Allowed

- Empty summary of what was just said
- "In conclusion…"
- Marketing call-to-action ("Sign up now!")

---

## Structural Signatures

- **Headers as mini-theses:** Not decorative—each header should be a claim or direction
- **Signposting that moves:** "But first…", "Here's the thing…", "So where does that leave us?"
- **Parenthetical texture:** Caveats, humanity, small admissions
- **Context jumps:** Quick explanations for unfamiliar terms, then back to momentum
- **Bold used sparingly:** For the single emphasis that matters

---

## Content Modes

The goal of the content determines its shape. Match the container.

### README / CLAUDE.md

- Expedition metaphors welcome where they clarify
- Focus on orientation and preparation
- Quick Start gets to code fast — context comes after
- "Here's what you need to know before diving in"

### Blog Posts

- Full voice DNA applies
- Narrative arc: problem → journey → discovery → reflection
- Vulnerability + precision blend
- Technical without gatekeeping
- Room to breathe and explain the why

### Announcements

- Lead with value, not company news
- "Here's what you can do now" over "We built X"
- Specifics over superlatives

### Technical Docs

- Voice recedes; clarity leads
- Skip expedition metaphors
- Precision and completeness matter most
- Don't make people scroll past backstory to get the recipe

### API Reference

- Precision over personality
- Just the facts
- Examples are copy-paste runnable

---

## Anti-Patterns

### Voice Violations

- Corporate-speak or press-release gloss
- Excessive hedging or qualification
- Lecturing or talking down
- Manufactured enthusiasm
- Vague abstractions without examples

### Structural Violations

- Burying the lede
- Walls of text without signposts
- Over-formatting (headers as decoration)
- Ending with a thud instead of a door

### Model-Specific Anti-Patterns

- Over-signposting ("Now…" spam)
- Generic "Tech Blogger" voice
- Preamble before getting to the point
- Empty concluding summaries

---

## The Litmus Test

Before publishing, ask:

1. **Would Matt say this to a smart friend over coffee?**
2. **Is there a concrete example within two paragraphs of any claim?**
3. **Does the ending open a door or close with a thud?**
4. **Would a reader roll their eyes at any metaphor?**
5. **Is enthusiasm earned or manufactured?**

If any answer is wrong, revise.

---

## References

- [SAMPLES.md](references/SAMPLES.md) — Golden examples from Outfitter blog posts for pattern-matching

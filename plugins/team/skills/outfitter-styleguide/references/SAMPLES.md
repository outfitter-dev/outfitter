# Voice Samples

Golden examples from Outfitter blog posts for pattern-matching.

---

## Opening Moves

### Vulnerability Hook (BLZ post)

> "I've co-founded five startups, raised $60M+, and shipped products to millions of users. But the engineering? Always in someone else's hands."

**Why it works:**
- High status established immediately (5 startups, $60M)
- Pivots to vulnerability ("Always in someone else's hands")
- Creates tension that the rest of the post resolves
- Reader thinks: "If this guy couldn't do it, maybe I'm not alone"

### Problem Framing (Outfitter intro)

> "Bugs galore, code that was unmaintainable, and countless hours lost to ill-fated ideas."

**Why it works:**
- Admits failure before claiming success
- Specific enough to be credible ("unmaintainable," "ill-fated")
- Sets up the solution without overselling

---

## Punch-and-Flow in Action

### Setup → Pivot → Punch

> "Recently we've seen agents waste 60,000+ tokens per documentation lookup. That's not a rounding error—that's the whole context window. BLZ returns results in 5-50ms."

**Breakdown:**
- **Setup:** "Recently we've seen agents waste 60,000+ tokens…"
- **Pivot:** "That's not a rounding error—"
- **Punch:** "that's the whole context window."
- **Resolution:** "BLZ returns results in 5-50ms."

### Earned Enthusiasm

> "I actually laughed out loud when I saw the result: 6 milliseconds."

**Why it works:**
- Personal reaction, not marketing claim
- Specific number carries the weight
- Reader can imagine the moment

---

## Status Modulation Examples

### High Status (Technical Precision)

> "Uses Tantivy for full-text indexing. Think `ripgrep`, purpose-built for documentation."

**Why it works:**
- Names the actual technology (credibility)
- Provides accessible analogy (ripgrep) for those who don't know Tantivy
- "Purpose-built" signals intentional design, not hack

### Low Status (Builder's Vulnerability)

> "BLZ isn't a totally polished, or fully baked product yet."

**Why it works:**
- Honest about limitations
- "Yet" signals trajectory without overpromising
- Builds trust through transparency

### The Blend

> "This is my first shipped tool. Despite founding five startups, I'd never written production code that others actually use. Agents changed that."

**Why it works:**
- Vulnerability (never shipped code) wrapped in credibility (five startups)
- "Agents changed that" points forward without hype
- Reader understands the stakes were personal

---

## Technical Without Gatekeeping

### Complex Concept Made Accessible

> "Context engineering—delivering the right data, at the right time, in the right shape."

**Why it works:**
- Introduces jargon ("context engineering")
- Immediately defines it in plain terms
- The three-part structure is memorable

### Showing the Work

```
blz add bun https://bun.sh/llms.txt
blz "dependency management" --source bun
blz get bun:304–324
```

**Why it works:**
- Concrete commands, not abstract description
- Reader can try it immediately
- Line numbers (304-324) signal precision

---

## Closing Moves

### Invitation (BLZ post)

> "If you're building with agents, give it a shot. The index is local, the queries are fast, and the citations are deterministic."

**Why it works:**
- Clear audience ("building with agents")
- Low-commitment ask ("give it a shot")
- Three concrete benefits, not vague promise

### Door Left Ajar (Outfitter intro)

> "Go confidently in the direction of your dreams. Live the life you've imagined."

**Why it works:**
- Quote earns its place (Thoreau ties to expedition theme)
- Aspirational without being preachy
- Leaves reader thinking, not summarizing

---

## Expedition Metaphors That Work

### Earned

> "Well-supplied teams build better software."

**Why it works:**
- Natural extension of "Outfitter" name
- Makes a real claim (supplies → outcomes)
- Doesn't force the metaphor

### Also Earned

> "The right provisions for the journey ahead."

**Why it works:**
- "Provisions" = dependencies/tools (clear mapping)
- "Journey" = project (natural fit)
- Would survive if you stripped the metaphor

---

## Expedition Metaphors to Avoid

### Forced

> "Traverse the codebase wilderness with your trusty CLI companion!"

**Why it fails:**
- "Traverse" is trying too hard
- "Wilderness" overstates the drama
- "Trusty companion" is cutesy
- Reader eye-roll incoming

### Better Version

> "Navigate the codebase with a CLI that knows where to look."

**Why it works:**
- "Navigate" is natural
- Drops the forced drama
- Focuses on utility

---

## Anti-Pattern Examples

### Generic Tech Blogger (Avoid)

> "In today's fast-paced development landscape, documentation has become increasingly important. That's why we built BLZ—a revolutionary tool that will transform how you work with docs."

**What's wrong:**
- "Fast-paced development landscape" = filler
- "Increasingly important" = says nothing
- "Revolutionary" = unearned superlative
- "Transform how you work" = vague promise

### Outfitter Voice (Better)

> "Agents burn through context windows searching docs. BLZ indexes them locally and returns results in milliseconds."

**What's right:**
- Problem stated concretely
- Solution stated concretely
- No wasted words

---

## The Coffee Test

Read any sentence aloud. Would you actually say this to a smart friend explaining what you built?

**Fails the test:**
> "We are thrilled to announce the launch of our innovative documentation solution."

**Passes the test:**
> "I built a thing that searches docs in 6 milliseconds. Want to try it?"

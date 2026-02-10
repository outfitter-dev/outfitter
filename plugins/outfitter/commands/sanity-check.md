---
description: Challenge complexity and find simpler alternatives before implementing
argument-hint: [proposed solution or approach to evaluate]
---

# Challenge Complexity

Evaluate the proposed solution for unnecessary complexity before committing to it.

## Instructions

- Consider the recent conversation history, your context, and the proposal to be evaluated.
- Specific user instructions should be followed unless they are contradictory to the task at hand. $ARGUMENTS

## Steps

1. **Load** — Use the Skill tool and load the `outfitter:sanity-check` skill
2. **Consider** — Ultrathink and analyze the proposal, identify initial complexity concerns
3. **Dispatch or Execute** — Choose execution path based on available tools:
   - **If Task tool available**: Run the simplify loop (see below)
   - **If Task tool unavailable**: Execute the complexity analysis methodology directly using the loaded skill

## Simplify Loop (when Task tool available)

Run iterative cycles with a persistent skeptic agent until complexity is resolved:

```text
┌─────────────────────────────────────────────────────────────┐
│  1. ANALYZE — Dispatch outfitter:skeptic                    │
│     └─ Examine proposal, identify complexity triggers,      │
│        generate alternatives, return structured findings    │
│                          ↓                                  │
│  2. PRESENT — Share findings with user                      │
│     └─ Escalation level, alternatives, probing questions    │
│                          ↓                                  │
│  3. DISCUSS — Gather user response                          │
│     └─ User provides context, answers questions,            │
│        or asks skeptic to dig deeper                        │
│                          ↓                                  │
│  4. EVALUATE — Determine next action                        │
│     └─ If resolved → Document decision                      │
│     └─ If more analysis needed → Resume skeptic (step 1)    │
└─────────────────────────────────────────────────────────────┘
```

### Loop Execution

1. **Initial dispatch** — Pass proposal, context, requirements to skeptic
2. **Retrieve results** — Use TaskOutput to get structured JSON analysis
3. **Present to user** — Share escalation level, alternatives, and probing questions
4. **Gather feedback** — User may:
   - Answer probing questions (pass answers back to skeptic)
   - Ask skeptic to examine specific aspects deeper
   - Accept an alternative and proceed
   - Justify complexity with evidence (skeptic validates)
5. **Resume or conclude**:
   - **More analysis needed**: Resume same skeptic agent with `resume: {agentId}` and new context
   - **Decision reached**: Document outcome (proceed with simple, proceed with justified complexity, or revisit approach)

### Resumable Skeptic Pattern

The skeptic maintains context across invocations via the `resume` parameter:

```text
Initial dispatch:
  → skeptic analyzes proposal
  → returns findings + agentId: "abc123"

User provides additional context:
  → resume skeptic with { resume: "abc123" }
  → skeptic refines analysis with new information

User asks about specific concern:
  → resume skeptic with { resume: "abc123" }
  → skeptic digs deeper on that aspect
```

This preserves the skeptic's understanding of the proposal through multiple rounds of refinement.

## The Framework

1. IDENTIFY — what complexity is being proposed?
2. ALTERNATIVE — what's the simplest thing that could work?
3. QUESTION — why isn't the simple approach sufficient?
4. DOCUMENT — if complexity is justified, record why

## Context Handoff (for initial dispatch)

When dispatching to the skeptic subagent, include:
- The proposed solution or approach
- Current requirements and constraints
- Any justifications already offered
- Team/project context if relevant

When resuming the skeptic, include:
- User's answers to probing questions
- Additional context or constraints revealed
- Specific areas to examine further
- Evidence offered to justify complexity

## Red Flag Rationalizations

Watch for these justifications — they usually indicate unjustified complexity:

- "We might need this later"
- "It's more flexible this way"
- "This is how X company does it"
- "It's the industry standard"
- "We should do it right the first time"

## Verdicts and Outcomes

The skeptic returns one of three verdicts:

| Verdict | Meaning | Action |
|---------|---------|--------|
| **proceed** | Complexity is minor (🟡) | Note alternatives, continue |
| **caution** | Complexity is moderate (🟠) | Discuss before proceeding |
| **block** | Complexity is high risk (🛑) | Address concerns first |

After discussion, document the outcome:
- **Simplified**: Chose simpler alternative
- **Justified**: Complexity validated with evidence, documented in ADR
- **Deferred**: Needs more investigation, created follow-up task

The goal is NOT to reject all complexity — it's to ensure complexity is justified by evidence, not speculation.

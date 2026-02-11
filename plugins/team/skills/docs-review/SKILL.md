---
name: docs-review
description: "Reviews documentation for voice, style, and structure alignment with Outfitter standards. Use when reviewing docs or checking content quality."
context: fork
agent: editor
metadata:
  version: "1.1.0"
  author: outfitter
  category: documentation
---

# Documentation Review

Review the current document against Outfitter standards for voice, style, and structure.

## Steps

1. **Skills**: Load the following skills: `voice`, `styleguide`, `docs-check`. If you cannot, do not proceed, but report this.
1. **Direction**: $ARGUMENTS — If provided, focus on that aspect. Otherwise, review all dimensions.
2. **Voice**: Verify Outfitter voice (see `voice` skill): confident stance, agent-first framing, plain language over jargon.
3. **Style**: Verify craft patterns (see `styleguide` skill): punch-and-flow rhythm, earned enthusiasm, strong opening and closing.
4. **Structure**: Verify documentation patterns (see `docs-check` skill): appropriate template, runnable examples, correct heading hierarchy.
5. **Report**: Provide a detailed report of your findings based on the template below.
   - NOTE: If the document is ready, say so briefly. If it needs work, be specific about locations and fixes.

## Template

Use the report structure in [TEMPLATE.md](TEMPLATE.md).

---
description: Quick audit of current file or directory for Outfitter Stack compliance
argument-hint: [file or directory]
---

# Stack Check

Load the `outfitter-stack:outfitter-check` skill to check **$ARGUMENTS** (or current directory if not specified) for @outfitter/* pattern compliance.

The skill scans for anti-patterns and produces a severity-ranked compliance report:
- Critical: Thrown exceptions, try/catch control flow
- High: Console usage, hardcoded paths
- Medium: Custom error classes, missing context
- Low: Style issues, missing schema descriptions

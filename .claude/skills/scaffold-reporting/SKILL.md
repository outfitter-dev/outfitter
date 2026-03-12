---
name: scaffold-reporting
version: 0.1.0
description: "Synthesize scaffold test reports into cross-preset summaries with score aggregation, trend analysis, and Linear issue recommendations. Use after scaffold testing completes."
---

# Scaffold Reporting

Synthesize per-preset scaffold test reports into a unified summary with cross-cutting analysis.

## Workflow

### Step 1: Gather Reports

Read all `report.json` files from the run directory. Use the manifest to locate preset directories and their report paths.

For each preset in the manifest:

- If status is `completed`, read `report.json` from the preset directory
- If status is `errored`, note the error but continue with available reports
- If status is `pending`, flag as incomplete

### Step 2: Aggregate Scores

For each scoring dimension (agentReadiness, documentationCompleteness, errorClarity, setupFriction, typeCorrectness, overall), compute:

- **mean**: Average across all completed presets
- **min**: Lowest score (identify the weakest preset)
- **max**: Highest score (identify the strongest preset)
- **stddev**: Standard deviation (consistency across presets)

### Step 3: Cross-Reference

Identify patterns across presets:

- Same errors appearing in multiple presets (shared dependency issues, common template bugs)
- Consistently low dimensions (systematic weakness in scaffolding)
- Common dependency warnings or resolution issues
- Doc inconsistencies that appear across multiple presets

### Step 4: Categorize Findings

Group all findings from individual reports:

- **blocking**: Prevents setup or core functionality (phase failures, missing deps)
- **degraded**: Works but with significant quality issues (low scores, missing docs)
- **cosmetic**: Minor issues (formatting, naming, non-critical warnings)

Deduplicate findings that appear across presets — merge into a single cross-cutting issue with affected preset list.

### Step 5: Draft Linear Issues

For each blocking or degraded finding:

1. Draft a Linear issue with:
   - Title: concise description of the issue
   - Labels: `scaffold-trial` + severity label (`blocking` or `degraded`)
   - Body: description, affected presets, evidence from reports, suggested fix
   - Team: Stack (OS)
2. Search Linear for existing issues with similar titles to avoid duplicates
3. If a duplicate exists, add a comment with the new run's findings instead

### Step 6: Write Output

Write two files to the run directory:

**`summary.json`** — Structured summary following `references/summary-schema.md`

**`summary.md`** — Human-readable summary with:

- Run metadata (ID, timestamp, preset count)
- Pass/fail table per preset
- Score heatmap (table with dimensions as columns, presets as rows)
- Cross-cutting issues with severity
- Filed Linear issue links
- Recommendations for next steps

### Step 7: File Issues

Use Linear MCP tools to:

1. Search for duplicates first (`mcp__linear__linear` with `action: "search"`)
2. Create new issues for novel findings (`mcp__claude_ai_Linear__save_issue`)
3. Add comments to existing issues for known patterns
4. Record all filed/updated issue URLs in `summary.json`

## References

- `references/summary-schema.md` — Full JSON schema for summary output

---
name: scaffold-trial
version: 0.1.0
description: "Orchestrate scaffold smoke testing across presets. Dispatches parallel tester agents, collects reports, synthesizes findings, and files Linear issues. Use when scaffold trial, smoke test presets, or /scaffold-trial are mentioned."
user-invocable: true
argument-hint: "[preset1,preset2,...] or 'all' (default: smart selection based on changes, 'all' always available)"
---

# Scaffold Trial

Orchestrate agent-driven scaffold smoke testing across all presets.

## Workflow

### Step 1: Parse Arguments

If `$ARGUMENTS` is provided:
- `all` → test all 7 presets: cli, library, full-stack, minimal, basic, mcp, daemon
- Comma-separated list → test only those presets (validate each is a valid preset name)
- Empty → offer smart selection (see below)

**Smart selection** (when no arguments):
1. Run `git log --oneline -20` to see recent changes
2. Map changed packages to affected presets:
   - `@outfitter/cli` changes → cli, full-stack
   - `@outfitter/mcp` changes → mcp, full-stack
   - `@outfitter/daemon` changes → daemon
   - `packages/presets` changes → all presets
   - `apps/outfitter` (init command) changes → all presets
3. Present options to user via AskUserQuestion:
   - Suggested subset based on changes
   - "all" option always available
   - Individual preset selection

### Step 2: Prune Old Runs

Delete `.test/scaffolds/` entries older than 7 days:

```bash
find .test/scaffolds/ -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +
```

Create `.test/scaffolds/` if it doesn't exist.

### Step 3: Create Run Directory

Generate run ID: `YYYYMMDDTHHmmss-trial-<uuid-v7>`

Create directory structure:
```
.test/scaffolds/<run-id>/
  <preset>/     # One subdir per selected preset
```

### Step 4: Initialize Manifest

Write `manifest.json` to the run directory:

```json
{
  "runId": "<run-id>",
  "startedAt": "<ISO 8601>",
  "presets": {
    "<preset>": { "status": "pending", "reportPath": ".test/scaffolds/<run-id>/<preset>/report.json" }
  }
}
```

### Step 5: Dispatch Tester Agents

For each preset, launch a `scaffold-tester` agent:

```
Agent tool call:
  subagent_type: "scaffold-tester"
  run_in_background: true
  prompt: |
    Test the "<preset>" scaffold preset.

    Run directory: <absolute-path-to-run-dir>/<preset>/
    Preset: <preset>
    Run ID: <run-id>
    Report path: <absolute-path-to-run-dir>/<preset>/report.json

    Set OUTFITTER_SCAFFOLD_TRIAL_RUN_DIR=<absolute-path-to-run-dir> for telemetry.

    Scaffold command (run from repo root <repo-root>):
    bun ./apps/outfitter/src/cli.ts init <absolute-path-to-run-dir>/<preset>/project --name scaffold-e2e-<preset> --preset <preset> --yes --skip-git --skip-commit

    Follow the scaffold-testing skill workflow completely. Write report.json when done.
```

Launch ALL preset agents in a single message (parallel dispatch). Record each agent ID in the manifest immediately.

Update manifest after each dispatch:
```json
{ "status": "running", "agentId": "<agent-id>" }
```

### Step 6: Track Completion

As agents complete (you'll be notified automatically — do NOT poll):
- Update manifest status to `completed` or `errored`
- If an agent errors, record the error message in the manifest
- Continue waiting for remaining agents

Timeout: If an agent hasn't completed after 10 minutes, note it as timed out in the manifest.

### Step 7: Handle Failures

For any agent that crashes or times out:
- Mark as `errored` in manifest with error details
- Continue with available reports — don't abort the whole run

### Step 8: Synthesize

Once all agents have completed (or timed out):
1. Load the `scaffold-reporting` skill
2. Follow its workflow to generate `summary.json` and `summary.md`
3. File Linear issues for blocking/degraded findings

### Step 9: Present Results

Show the user a formatted results table:

```
Scaffold Trial: <run-id>
═══════════════════════════════════════

Preset       Status    Overall  Agent ID
───────────────────────────────────────
cli          PASS      8/10     abc123
library      PASS      7/10     def456
full-stack   FAIL      5/10     ghi789
minimal      PASS      6/10     jkl012
mcp          ERROR     --       mno345
daemon       PASS      7/10     pqr678

Score Summary (mean / min / max):
  Agent Readiness:    7.2 / 5 / 9
  Setup Friction:     7.8 / 6 / 9
  Doc Completeness:   7.0 / 4 / 9
  Error Clarity:      6.5 / 3 / 8
  Type Correctness:   8.0 / 6 / 10

Linear Issues Filed: 2
  OS-xxx: Missing verify:ci in minimal/daemon
  OS-yyy: Build failure in full-stack preset

Run directory: .test/scaffolds/<run-id>/
```

Include agent IDs so the user can resume individual agents for follow-up.

## References

- `references/manifest-schema.md` — Manifest JSON structure

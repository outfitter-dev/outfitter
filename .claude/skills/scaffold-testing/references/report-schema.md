# Report Schema

JSON schema for `report.json` produced by each scaffold tester agent.

## Schema

```json
{
  "preset": "cli | library | full-stack | minimal | mcp | daemon",
  "runId": "YYYYMMDDTHHmmss-trial-<uuid-v7>",
  "agentId": "<agent-id-from-agent-tool>",
  "timestamp": "ISO 8601",
  "metadata": {
    "outfitterVersion": "string (from package.json or CLI output)",
    "bunVersion": "string (from bun --version)",
    "platform": "string (darwin, linux, etc.)"
  },
  "phases": {
    "scaffold": {
      "ok": true,
      "durationMs": 1200,
      "stdout": "...",
      "stderr": "..."
    },
    "install": {
      "ok": true,
      "durationMs": 4500,
      "stdout": "...",
      "stderr": "..."
    },
    "build": {
      "ok": false,
      "error": "exit code 1: ...",
      "durationMs": 800,
      "stdout": "...",
      "stderr": "..."
    },
    "verify": {
      "skipped": true,
      "reason": "build failed"
    }
  },
  "scores": {
    "agentReadiness": {
      "score": 7,
      "reasoning": "CLAUDE.md present with handler patterns documented, but missing troubleshooting section..."
    },
    "documentationCompleteness": {
      "score": 8,
      "reasoning": "README covers setup and usage, package.json has all scripts..."
    },
    "errorClarity": {
      "score": 6,
      "reasoning": "Result types used in handlers but error messages lack actionable context..."
    },
    "setupFriction": {
      "score": 5,
      "reasoning": "Requires reading README to understand build step..."
    },
    "typeCorrectness": {
      "score": 9,
      "reasoning": "Strict mode enabled, no any types, Result types throughout..."
    },
    "overall": {
      "score": 7,
      "reasoning": "Weighted: agentReadiness(25%) + setupFriction(25%) + docs(20%) + errors(15%) + types(15%)"
    }
  },
  "findings": [
    {
      "severity": "blocking | degraded | cosmetic",
      "description": "Build fails due to missing type export in src/index.ts",
      "file": "src/index.ts",
      "line": 12
    }
  ],
  "docInconsistencies": [
    {
      "source": "outfitter-atlas",
      "claim": "All handlers should use HandlerContext with progress callback",
      "actual": "Handler uses plain object without progress support",
      "file": "src/handlers/example.ts"
    }
  ],
  "suggestions": [
    "Add troubleshooting section to CLAUDE.md",
    "Include verify:ci script in package.json"
  ]
}
```

## Field Details

### `phases`

Each phase is one of:

- **Success**: `{ "ok": true, "durationMs": number, "stdout": string, "stderr": string }`
- **Failure**: `{ "ok": false, "error": string, "durationMs": number, "stdout": string, "stderr": string }`
- **Skipped**: `{ "skipped": true, "reason": string }`

### `scores`

Each score has:

- `score`: Integer 1-10
- `reasoning`: String citing specific evidence (file paths, line numbers, command output)

### `findings`

Severity levels:

- `blocking`: Prevents setup or core functionality from working
- `degraded`: Works but with significant quality issues
- `cosmetic`: Minor issues that don't affect functionality

### `docInconsistencies`

Found by cross-checking scaffold output against `outfitter-atlas` patterns:

- `source`: Which reference document or pattern
- `claim`: What the reference says should be true
- `actual`: What the scaffold actually produces
- `file`: File where the inconsistency is observed

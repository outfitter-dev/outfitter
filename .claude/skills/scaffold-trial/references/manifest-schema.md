# Manifest Schema

JSON schema for `manifest.json` — the coordinator's state file for a scaffold trial run.

## Schema

```json
{
  "runId": "YYYYMMDDTHHmmss-trial-<uuid-v7>",
  "startedAt": "ISO 8601",
  "presets": {
    "cli": {
      "agentId": "abc123",
      "status": "completed",
      "reportPath": ".test/scaffolds/<run-id>/cli/report.json"
    },
    "library": {
      "agentId": "def456",
      "status": "completed",
      "reportPath": ".test/scaffolds/<run-id>/library/report.json"
    },
    "mcp": {
      "agentId": "ghi789",
      "status": "errored",
      "error": "Agent timed out after 600s",
      "reportPath": ".test/scaffolds/<run-id>/mcp/report.json"
    },
    "minimal": {
      "status": "pending",
      "reportPath": ".test/scaffolds/<run-id>/minimal/report.json"
    }
  },
  "completedAt": "ISO 8601 (set when all agents finish)",
  "summaryPath": ".test/scaffolds/<run-id>/summary.json"
}
```

## Status Lifecycle

Each preset progresses through:

```
pending → running → completed | errored
```

| Status | Meaning | Fields Set |
|--------|---------|------------|
| `pending` | Not yet dispatched | `reportPath` |
| `running` | Agent dispatched, awaiting completion | `agentId`, `reportPath` |
| `completed` | Agent finished, report.json available | `agentId`, `reportPath` |
| `errored` | Agent crashed, timed out, or failed | `agentId`, `reportPath`, `error` |

## Field Details

### `runId`

Format: `YYYYMMDDTHHmmss-trial-<uuid-v7>` — matches the run directory name.

### `startedAt` / `completedAt`

ISO 8601 timestamps. `completedAt` is set when all agents have finished (completed or errored).

### `presets`

Map of preset name to status object. Keys are valid `InitPresetId` values: basic, cli, library, full-stack, minimal, mcp, daemon.

### `summaryPath`

Set after synthesis step completes. Points to the generated `summary.json`.

## Usage

The coordinator updates the manifest at each stage:
1. **Create**: All presets as `pending`
2. **Dispatch**: Update to `running` with `agentId`
3. **Complete**: Update to `completed` or `errored`
4. **Finalize**: Set `completedAt` and `summaryPath`

Agents can be resumed by ID from the manifest for follow-up questions or re-runs.

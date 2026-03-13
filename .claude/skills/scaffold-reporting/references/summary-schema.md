# Summary Schema

JSON schema for `summary.json` produced by the scaffold-reporting skill.

## Schema

```json
{
  "runId": "YYYYMMDDTHHmmss-trial-<uuid-v7>",
  "timestamp": "ISO 8601",
  "presetCount": 6,
  "passCount": 4,
  "failCount": 2,
  "scores": {
    "agentReadiness": {
      "mean": 7.2,
      "min": 5,
      "max": 9,
      "stddev": 1.4
    },
    "documentationCompleteness": {
      "mean": 7.0,
      "min": 4,
      "max": 9,
      "stddev": 1.8
    },
    "errorClarity": {
      "mean": 6.5,
      "min": 3,
      "max": 8,
      "stddev": 1.6
    },
    "setupFriction": {
      "mean": 7.8,
      "min": 6,
      "max": 9,
      "stddev": 1.1
    },
    "typeCorrectness": {
      "mean": 8.0,
      "min": 6,
      "max": 10,
      "stddev": 1.2
    },
    "overall": {
      "mean": 7.3,
      "min": 5,
      "max": 9,
      "stddev": 1.3
    }
  },
  "crossCuttingIssues": [
    {
      "title": "Missing verify:ci script in package.json",
      "affectedPresets": ["minimal", "daemon"],
      "severity": "degraded",
      "category": "setup",
      "description": "Two presets lack verify:ci, forcing fallback to bun test",
      "evidence": "Phase 5 fell back to bun test in both presets"
    }
  ],
  "presetSummaries": {
    "cli": {
      "passed": true,
      "overall": 8,
      "failedPhase": null,
      "topFinding": null
    },
    "mcp": {
      "passed": false,
      "overall": 5,
      "failedPhase": "build",
      "topFinding": "Missing type export causes build failure"
    }
  },
  "linearIssues": [
    {
      "title": "[scaffold-trial] Missing verify:ci in minimal and daemon presets",
      "url": "https://linear.app/outfitter/issue/OS-xxx",
      "presets": ["minimal", "daemon"],
      "action": "created | commented"
    }
  ]
}
```

## Field Details

### `scores`

Aggregated across all completed preset reports. Each dimension has:

- `mean`: Average score (1 decimal place)
- `min`: Lowest score across presets
- `max`: Highest score across presets
- `stddev`: Standard deviation (1 decimal place)

### `crossCuttingIssues`

Issues that appear in 2+ presets, deduplicated from individual report findings:

- `title`: Concise description
- `affectedPresets`: List of preset names
- `severity`: `blocking | degraded | cosmetic`
- `category`: Grouping (setup, docs, types, errors, build)
- `description`: Detailed description with context
- `evidence`: Specific evidence from reports

### `presetSummaries`

Quick-reference per preset:

- `passed`: All phases succeeded (ok or skipped-by-design)
- `overall`: Overall score from the preset's report
- `failedPhase`: First phase that failed, or null
- `topFinding`: Most severe finding, or null

### `linearIssues`

Tracking for filed issues:

- `title`: Issue title as filed
- `url`: Linear issue URL
- `presets`: Which presets this issue affects
- `action`: Whether the issue was `created` new or `commented` on an existing one

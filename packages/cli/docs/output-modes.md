# Output Modes

CLI commands default to human-readable output. Machine-readable formats are opt-in via the `--output` flag or environment variables.

## Available Modes

| Mode | Flag | Description |
|------|------|-------------|
| `human` | `--output human` | Formatted text for terminal display (default) |
| `json` | `--output json` | Single JSON object or array |
| `jsonl` | `--output jsonl` | Newline-delimited JSON (one object per line) |

## Selecting a Mode

Use the `-o` / `--output` flag:

```bash
mycli list --output json
mycli list -o jsonl
```

Or set environment variables (useful in CI):

```bash
OUTFITTER_JSON=1 mycli list     # Force JSON
OUTFITTER_JSONL=1 mycli list    # Force JSONL
```

## Priority

The resolved mode follows this precedence (highest wins):

1. Explicit `--output <mode>` flag
2. `OUTFITTER_JSONL=1`
3. `OUTFITTER_JSON=1`
4. Default: `human`

Setting `OUTFITTER_JSON=0` or `OUTFITTER_JSONL=0` explicitly forces human mode.

## Filtering with jq

Commands that support `--jq` allow inline filtering of JSON output:

```bash
mycli list --output json --jq '.[] | .name'
```

The `--jq` flag requires an output mode that produces JSON (`json` or `jsonl`).

## Adding Output Mode Support

Use the `outputModePreset` from `@outfitter/cli/query`:

```typescript
import { outputModePreset, jqPreset } from "@outfitter/cli/query";

const mode = outputModePreset({ includeJsonl: true });
const jq = jqPreset();
```

See [CLI Flag Conventions](../../../docs/cli/conventions.md) for the full preset catalog.

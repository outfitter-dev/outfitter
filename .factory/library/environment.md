# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Runtime

- **Bun**: Version pinned in `.bun-version`. CI reads from this file.
- **Node**: Not used directly. Bun is the runtime.
- **OS**: macOS (darwin). No Linux-specific concerns for this mission.

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OUTFITTER_ENV` | Environment profile | `production` |
| `OUTFITTER_LOG_LEVEL` | Override log level | (profile default) |
| `OUTFITTER_VERBOSE` | Override CLI verbosity | `0` |
| `OUTFITTER_JSON` | Force JSON output | `0` |
| `OUTFITTER_JSONL` | Force JSONL output | `0` |

## No External Services

This mission requires no databases, caches, APIs, or external services. Pure library work.

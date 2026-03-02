# User Testing

Testing surface: tools, URLs, setup steps, isolation notes, known quirks.

**What belongs here:** How to manually verify features, testing tools available, setup for testing.

---

## Testing Surface

This is a **library monorepo** with no web UI or running services. All user testing is via:

1. **Unit tests**: `bun run test` (full suite) or `bun run test --filter=@outfitter/<package>` (single package)
2. **Type checking**: `bun run typecheck`
3. **Lint**: `bun run lint`
4. **Import verification**: `bun -e "import { parseInput } from '@outfitter/contracts'"` to verify exports
5. **CLI verification**: `cd apps/outfitter && bun run src/index.ts <command>` to test CLI behavior
6. **Doc verification**: Check file presence and content at expected paths

## Testing Tools

- **Shell commands**: Primary tool for verification (run tests, check files, verify imports)
- **No browser testing**: No web UI to test
- **No agent-browser/tuistory**: Not applicable for library projects

## Package Test Commands

| Package                | Command                                      |
| ---------------------- | -------------------------------------------- |
| `@outfitter/cli`       | `bun run test --filter=@outfitter/cli`       |
| `@outfitter/contracts` | `bun run test --filter=@outfitter/contracts` |
| `@outfitter/testing`   | `bun run test --filter=@outfitter/testing`   |
| `@outfitter/mcp`       | `bun run test --filter=@outfitter/mcp`       |
| `outfitter` (app)      | `bun run test --filter=outfitter`            |
| All                    | `bun run test`                               |

## Verification Patterns

### API existence check

```bash
bun -e "const m = await import('@outfitter/contracts'); console.log(typeof m.parseInput)"
```

### Doc file check

```bash
test -f packages/contracts/docs/error-handling-patterns.md && echo "exists" || echo "missing"
```

### CLI behavior check

```bash
cd apps/outfitter && bun run src/index.ts schema --help
```

## Flow Validator Guidance: Shell

**Surface type:** Shell commands (test runner, typecheck, import verification, code inspection)

**Isolation rules:**
- All verification is read-only — no shared state concerns between parallel subagents
- Do not modify any source files
- Do not run `bun install` or any command that modifies node_modules
- Each subagent should run its own test/typecheck/grep commands independently

**Boundaries:**
- Work from repo root (the directory containing `AGENTS.md`)
- Use `bun test` for running tests, not `bun run test` (the latter uses Turbo which may conflict)
- For package-scoped tests: `cd <package-dir> && bun test` or `bun test --filter=<pattern>`
- For import verification: `bun -e "..."` from repo root
- For code inspection: use `rg` (ripgrep) or Read tool

**Known quirks:**
- `bun run check` crashes with tokio panic (pre-existing oxlint/oxfmt bug) — use `bun run lint` and `bun run typecheck` separately
- 3 pre-existing unrelated test failures in full suite (Registry Build Output, createOutfitterLoggerFactory) — ignore these

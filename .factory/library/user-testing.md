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

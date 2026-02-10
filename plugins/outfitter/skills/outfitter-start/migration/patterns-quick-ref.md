# Patterns Quick Reference

Quick lookup for conversion patterns. All details are in `outfitter-atlas`.

## Pattern Locations

| Converting | See Atlas |
|------------|----------------|
| `throw` → `Result.err()` | [patterns/conversion.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/conversion.md) |
| `console.*` → `ctx.logger.*` | [patterns/conversion.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/conversion.md) + [patterns/logging.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/logging.md) |
| Hardcoded paths → XDG | [patterns/conversion.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/conversion.md) |
| Custom errors → taxonomy | [patterns/errors.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/errors.md) |
| Third-party wrappers | [patterns/conversion.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/conversion.md) (wrapAsync section) |

## Error Taxonomy Quick Reference

| Category | Exit | HTTP | Use For |
|----------|------|------|---------|
| `validation` | 1 | 400 | Bad input |
| `not_found` | 2 | 404 | Missing resource |
| `conflict` | 3 | 409 | Already exists |
| `permission` | 4 | 403 | Forbidden |
| `timeout` | 5 | 504 | Too slow |
| `rate_limit` | 6 | 429 | Too many requests |
| `network` | 7 | 502 | Connection failed |
| `internal` | 8 | 500 | Unexpected |
| `auth` | 9 | 401 | Unauthenticated |
| `cancelled` | 130 | 499 | User cancelled |

Full details: [patterns/errors.md](${CLAUDE_PLUGIN_ROOT}/shared/patterns/errors.md)

## Conversion Checklist

Use during handler conversion:

- [ ] `throw` → `return Result.err(new XError(...))`
- [ ] `return value` → `return Result.ok(value)`
- [ ] `try { } catch { }` → Early returns with `if (result.isErr()) return result`
- [ ] Caller uses `if (result.isErr())` instead of `try/catch`
- [ ] `console.log` → `ctx.logger.info`
- [ ] `console.error` → `ctx.logger.error`
- [ ] `os.homedir()` → `getConfigDir()` / `getDataDir()` / etc.
- [ ] Custom error class → Taxonomy error with details

## Templates

| Need | Template |
|------|----------|
| Handler | [templates/handler.md](${CLAUDE_PLUGIN_ROOT}/shared/templates/handler.md) |
| Handler test | [templates/handler-test.md](${CLAUDE_PLUGIN_ROOT}/shared/templates/handler-test.md) |
| CLI command | [templates/cli-command.md](${CLAUDE_PLUGIN_ROOT}/shared/templates/cli-command.md) |
| MCP tool | [templates/mcp-tool.md](${CLAUDE_PLUGIN_ROOT}/shared/templates/mcp-tool.md) |

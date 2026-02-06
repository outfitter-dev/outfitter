# v0.1-rc Deltas (Spec/Plan vs Current Code)

**Date**: 2026-01-24
**Baseline**: `SPEC.md` + `PLAN.md` frozen as of 2026-01-24

Legend:
- **Keep (intentional improvement)** — current code is better; document in RC notes.
- **Align to spec** — spec is better; change code or add compatibility.
- **Needs decision** — ambiguous; choose a direction and document.

| Area | Spec/Plan Expectation | Current Code | Status | RC Action |
| --- | --- | --- | --- | --- |
| `@outfitter/testing` MCP harness | `createMCPTestHarness({ tools, fixtures? })` | `createMcpHarness(server, { fixturesDir? })` | **Keep + compat** | Done: server-based API + `createMCPTestHarness` wrapper and alias. |
| `@outfitter/testing` CLI helpers | `captureCLI`, `mockStdin` | `createCliHarness(command)` | **Keep + add** | Done: `captureCLI` + `mockStdin` added alongside harness. |
| `@outfitter/testing` mock factories | `createTestContext`, `createTestLogger`, `createTestConfig` | Not implemented | **Align to spec** | Done: helpers implemented in `@outfitter/testing`. |
| `@outfitter/testing` fixtures/utils | Spec does not mention | `createFixture`, `withTempDir`, `withEnv` | **Keep** | Document as improvement. |
| Templates: placeholder vars | `{{name}}`, `{{packageName}}`, `{{description}}`, `{{author}}`, `{{year}}` | `{{projectName}}`, `{{binName}}`, `{{description}}` (+ `{{name}}` in basic) | **Keep + unify** | Support unified placeholder set (projectName/binName/packageName/description/author/year) with aliases; note `year` optional (for LICENSE/NOTICE headers). Author can be person or org. |
| Templates: scripts | `test:watch`, `lint:fix`, `dev:daemon` (for daemon) | Missing `test:watch`/`lint:fix` (CLI/MCP/Daemon) | **Align to spec** | Add missing scripts; define a standard script set for templates. |
| `outfitter init` UX | Only `init cli|mcp|daemon` | Adds `init` with `--template` (default `basic`) + `templates/basic` | **Keep + enhance** | Keep extra flexibility; add TTY wizard for template + naming (non-TTY remains deterministic). |
| `outfitter doctor` | Not specified | Implemented | **Keep** | Keep as enhancement; document in RC notes. |
| `@outfitter/mcp` runtime | Core tools, tool-search compat, transport auto-negotiation | Not implemented | **RC scope** | v0.1-rc: implement tool-search compatibility + minimal core tools (docs/config/query) with safe defaults/extension points; use explicit transport (stdio for now). Defer auto-negotiation; plan HTTP transport (streaming) later. |
| `@outfitter/index` | Version headers + migration scaffolding; compactor hooks; watcher invalidation | Not implemented | **Split** | v0.1-rc: implement version headers + migration scaffold; defer compactor/watcher hooks (file Linear issues). |
| Local scaffold install | Spec assumes working install | `bun install` fails for templates (packages not on npm) | **Hybrid** | Add `--local/--workspace` for dev + publish `0.1.0-*` tags for real installs. |

## Smoke Test Notes
- `outfitter init cli` succeeded locally (2026-01-24).
- `bun install` inside generated project failed because `@outfitter/*` packages are not published yet.

## Deferred Issues (Linear / MONO / Kit project)
- MONO-76: MCP: add HTTP transport (streaming)
- MONO-77: MCP: add transport auto-negotiation (stdio ↔ HTTP)
- MONO-78: Index: add compactor hooks
- MONO-79: Index: add watcher invalidation hooks

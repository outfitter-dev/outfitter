# Outfitter

Core development methodology and Claude Code extensibility. Provides disciplined approaches to TDD, debugging, architecture, research, code quality, plus skills for authoring plugins, agents, skills, commands, and hooks.

## Installation

```bash
# Add the Outfitter marketplace (if not already added)
/plugin marketplace add outfitter-dev/outfitter

# Install outfitter
/plugin install outfitter@outfitter
```

## What's Included

### Skills (29)

#### Development Methodology

| Skill | Purpose |
|-------|---------|
| `bun-fieldguide` | Bun runtime APIs and patterns |
| `cli-dev` | Redirect to cli-dev plugin |
| `code-review` | Pre-commit quality gate checklist |
| `codebase-analysis` | Evidence-based codebase investigation methodology |
| `sanity-check` | Pushback against over-engineering |
| `session-analysis` | Signal extraction from chat history |
| `debugging` | Systematic root cause investigation (no fixes without understanding) |
| `hono-fieldguide` | Type-safe Hono API development |
| `pathfinding` | Collaborative Q&A for unclear requirements |
| `find-patterns` | Identify and extract reusable patterns |
| `codify` | Extract reusable patterns from conversations |
| `performance` | Profiling and optimization |
| `react-fieldguide` | React 18-19 TypeScript patterns |
| `report-findings` | Structure and present research findings |
| `research` | Multi-source technical research with citations |
| `find-root-causes` | Systematic problem investigation methodology |
| `prove-it-works` | End-to-end testing without mocks |
| `security` | Security auditing and vulnerability detection |
| `systems-design` | System design with technology selection frameworks |
| `software-craft` | Engineering judgment and decision principles |
| `check-status` | Comprehensive status reports across VCS, PRs, issues, CI/CD |
| `use-subagents` | Orchestrate outfitter subagents for complex tasks |
| `tdd` | Test-driven development with Red-Green-Refactor cycles |
| `typescript-fieldguide` | TypeScript patterns and strict typing |
| `which-tool` | Detect and select optimal CLI tools for tasks |

#### Claude Code Extensibility

| Skill | Purpose |
|-------|---------|
| `skillcraft` | Agent Skills authoring (cross-platform spec) |
| `claude-craft` | Claude Code extensibility — agents, commands, hooks, skills, rules, config |
| `claude-plugins` | Full plugin lifecycle, marketplace distribution |

#### Platform Configuration

| Skill | Purpose |
|-------|---------|
| `codex-config` | OpenAI Codex CLI configuration |

### Agents (10)

| Agent | Role |
|-------|------|
| `quartermaster` | Equips and provisions Claude Code extensions (plugins, agents, skills, hooks) |
| `analyst` | Investigate, research, explore, identify patterns |
| `debugger` | Debug, diagnose, troubleshoot, trace |
| `librarian` | Find documentation, API references |
| `reviewer` | Review, critique, check, audit |
| `scout` | Status reports, project health, what's changed |
| `engineer` | Build, fix, implement, refactor |
| `skeptic` | Challenge assumptions and complexity |
| `specialist` | Domain-specific tasks (CI/CD, deploy) |
| `tester` | Test, validate, verify |

## Usage

Skills are loaded automatically when relevant triggers are detected. You can also invoke them explicitly:

```
Use the tdd skill to implement this feature
```

```
Use the reviewer agent to check this code
```

### Common Workflows

**Test-Driven Development:**

```
"Implement user authentication using TDD"
→ Loads tdd skill → Red-Green-Refactor cycle
```

**Debugging:**

```
"This API returns 500 errors intermittently"
→ Loads debugging skill → Root cause investigation
```

**Architecture Design:**

```
"Design a notification system for 100k users"
→ Loads systems-design skill → Options with tradeoffs
```

**Research:**

```
"What's the best approach for rate limiting?"
→ Loads research skill → Multi-source analysis with citations
```

## Philosophy

Outfitter enforces disciplined development practices:

- **Evidence over assumption** — Investigate before fixing
- **Tests before code** — Red-Green-Refactor, no exceptions
- **Simplicity over cleverness** — Challenge unnecessary complexity
- **Confidence tracking** — Know what you know and don't know

## Structure

```
outfitter/
├── .claude-plugin/
│   └── plugin.json
├── skills/           # 29 skills (methodology + extensibility)
├── agents/           # 10 specialized agents
├── commands/         # Slash commands
├── templates/        # Plugin/skill templates
├── scripts/          # Plugin utility scripts
└── README.md
```

## Capabilities

This plugin uses only standard Claude Code tools:

| Capability | Used | Notes |
|------------|------|-------|
| Filesystem | read | Reads code for analysis and review |
| Shell | no | — |
| Network | no | Research uses built-in WebSearch |
| MCP | no | — |
| Scripts | no | Instructions-only, no executable scripts |

See [SECURITY.md](../SECURITY.md) for the full security model.

## License

MIT

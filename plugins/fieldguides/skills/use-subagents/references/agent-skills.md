# Agent-Skill Mappings

Detailed breakdown of which skills each agent can load and when. Agents are grouped by their coordination role.

## engineer (coding role)

**Identity**: Builder, implementer, fixer.

| Skill | Load When |
|-------|-----------|
| software-craft | Always (core methodology) |
| tdd | New features, bug fixes requiring tests |
| bun-fieldguide | Bun runtime, package management |
| react-fieldguide | React components, hooks, state |
| hono-fieldguide | API routes, middleware, server |

**Typical combos**:
- `software-craft` + `tdd` (standard feature)
- `software-craft` + `react-fieldguide` (frontend work)
- `software-craft` + `hono-fieldguide` (API endpoint)

## reviewer (reviewing role)

**Identity**: Evaluator, quality guardian.

| Skill | Load When |
|-------|-----------|
| code-review | PR reviews, code audits |
| performance | Performance concerns, optimization |
| systems-design | Architecture decisions, structural changes |
| security | Security audits, auth review |

**Typical combos**:
- `code-review` (standard PR review)
- `code-review` + `systems-design` (significant refactor)
- `code-review` + `performance` (performance-critical code)
- `code-review` + `security` (auth or sensitive code)

## analyst (research role)

**Identity**: Investigator, researcher.

| Skill | Load When |
|-------|-----------|
| codebase-analysis | Understanding existing code |
| research | External research, comparisons |
| pathfinding | Unclear requirements, many unknowns |
| status | Project status, progress reports |
| report-findings | Structuring analysis output |
| find-patterns | Analyzing code patterns |
| codify | Extracting reusable workflows |
| session-analysis | Mining conversation for patterns |

**Typical combos**:
- `codebase-analysis` + `report-findings` (codebase exploration)
- `research` (technology comparison)
- `pathfinding` (requirements clarification)
- `codify` + `session-analysis` (capture workflow from session)
- `find-patterns` (analyze codebase patterns)

## debugger (debugging role)

**Identity**: Problem solver, root cause finder.

| Skill | Load When |
|-------|-----------|
| debugging | Always (core methodology) |
| codebase-analysis | Understanding surrounding code |

**Typical combos**:
- `debugging` (standard debugging)
- `debugging` + `codebase-analysis` (unfamiliar codebase)

## tester (testing role)

**Identity**: Validator, proof provider.

| Skill | Load When |
|-------|-----------|
| prove-it-works | End-to-end validation, integration tests |
| tdd | TDD workflow, test-first approach |

**Typical combos**:
- `prove-it-works` (feature validation)
- `tdd` (TDD implementation)

## skeptic (challenging role)

**Identity**: Complexity challenger, assumption questioner.

| Skill | Load When |
|-------|-----------|
| sanity-check | Always (core methodology) |

**Typical combos**:
- `sanity-check` (challenge proposals)

## specialist (specialist role)

**Identity**: Domain expert, infrastructure handler.

| Skill | Load When |
|-------|-----------|
| (dynamic) | Based on task domain |

**Examples**:
- CI/CD configuration → loads relevant CI patterns
- Design review → loads design/UX patterns
- Accessibility audit → loads a11y patterns
- Deployment → loads infrastructure patterns

Specialist loads skills dynamically based on detected domain. Other specialist agents (e.g., `cicd-expert`, `design-agent`, `bun-expert`) may be preferred when available.

## Skill Categories

### Core Methodology

Always relevant for the agent's identity:
- engineer: software-craft
- debugger: debugging
- skeptic: sanity-check

### Domain-Specific

Load based on technology in use:
- bun-fieldguide, react-fieldguide, hono-fieldguide

### Process-Oriented

Load based on workflow stage:
- tdd, code-review, prove-it-works

### Analysis-Oriented

Load for investigation and research:
- codebase-analysis, research, pathfinding

### Output-Oriented

Load for structuring deliverables:
- report-findings, status

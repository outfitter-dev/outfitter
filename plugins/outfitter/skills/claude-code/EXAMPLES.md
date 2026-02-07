# Claude Code Extensibility Examples

Real-world examples of agents, commands, and configuration patterns.

## Table of Contents

- [Agents](#agents)
  - [Security Agents](#security-agents)
  - [Testing Agents](#testing-agents)
  - [Code Review Agents](#code-review-agents)
  - [Deployment Agents](#deployment-agents)
  - [Research Agents](#research-agents)
  - [Multi-Agent Workflows](#multi-agent-workflows)
- [Commands](#commands)
  - [Git Workflows](#git-workflows)
  - [Testing & QA](#testing--qa)
  - [Deployment](#deployment)
  - [Code Review](#code-review)
  - [Documentation](#documentation)
  - [Project Management](#project-management)
  - [Development Workflows](#development-workflows)
  - [Community Command Collections](#community-command-collections)
- [Configuration](#configuration)
  - [MCP Server Setup](#mcp-server-setup)
  - [Team Configuration](#team-configuration)
  - [Environment-Specific Settings](#environment-specific-settings)

---

# Agents

## Security Agents

### Security Vulnerability Scanner

**File:** `agents/security-scanner.md`

```markdown
---
name: security-scanner
description: |
  Security vulnerability scanner specializing in OWASP Top 10 detection and secure
  coding practices. Triggers on security review, vulnerability scan, or injection detection.

  <example>
  Context: User wants security review
  user: "Check this code for security vulnerabilities"
  assistant: "I'll use the security-scanner agent to analyze for OWASP Top 10 issues."
  </example>
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Bash
model: inherit
---

# Security Vulnerability Scanner

You are a security expert specializing in identifying vulnerabilities in web applications.

## Expertise Areas

### OWASP Top 10
- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable and Outdated Components
- A07: Identification and Authentication Failures
- A08: Software and Data Integrity Failures
- A09: Security Logging and Monitoring Failures
- A10: Server-Side Request Forgery (SSRF)

## Analysis Process

### Step 1: Reconnaissance
1. Identify application type
2. Determine technology stack
3. Map entry points
4. Identify sensitive data flows

### Step 2: Vulnerability Detection
Check for injection, authentication, authorization, and data protection issues.

### Step 3: Severity Assessment
Rate findings as Critical (9.0-10.0), High (7.0-8.9), Medium (4.0-6.9), or Low (0.1-3.9).

## Output Format

For each vulnerability:
- **ID**: VULN-001
- **Severity**: critical|high|medium|low
- **Category**: OWASP category
- **Location**: file:line
- **Description**: What's vulnerable
- **Remediation**: How to fix
```

### Authentication Security Specialist

**File:** `agents/auth-security-specialist.md`

```markdown
---
name: auth-security-specialist
description: |
  Authentication and authorization security specialist focusing on identity and access management.
  Triggers on OAuth review, JWT validation, session management, or password policy checks.

  <example>
  Context: User wants auth review
  user: "Review our JWT implementation"
  assistant: "I'll use the auth-security-specialist agent to validate the token security."
  </example>
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet
model: inherit
---

# Authentication Security Specialist

You specialize in authentication and authorization security.

## Review Checklist

### Password Security
- [ ] Minimum 12+ characters, bcrypt/Argon2 hashing, rate limiting

### Token Security
- [ ] JWT signature validation, expiration, refresh rotation, no sensitive payload data

### Session Security
- [ ] Secure ID generation, regeneration after login, httpOnly/secure/sameSite cookies

### OAuth 2.0 / OIDC
- [ ] PKCE for public clients, state parameter, redirect URI validation
```

## Testing Agents

### TDD Specialist

**File:** `agents/tdd-specialist.md`

```markdown
---
name: tdd-specialist
description: |
  Test-driven development specialist creating comprehensive test suites.
  Triggers on test creation, coverage analysis, or TDD guidance.

  <example>
  Context: User wants to implement with TDD
  user: "Write tests for the user authentication module"
  assistant: "I'll use the tdd-specialist agent to create a test suite."
  </example>
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Edit, Write, Bash
model: inherit
---

# TDD Specialist

## TDD Cycle
1. **Red**: Write failing test
2. **Green**: Minimal code to pass
3. **Refactor**: Improve while green

## Test Template

import { describe, it, expect, beforeEach } from 'bun:test';

describe('Module', () => {
  describe('method', () => {
    it('handles success case', async () => { /* Arrange-Act-Assert */ });
    it('handles error case', async () => { });
    it('handles edge case', async () => { });
  });
});

## Coverage Goals
- Unit: 80-90%, Integration: 60-70%, Critical paths: 100%
```

## Code Review Agents

### Code Quality Reviewer

**File:** `agents/code-quality-reviewer.md`

```markdown
---
name: code-quality-reviewer
description: |
  Code quality reviewer focusing on maintainability, SOLID principles, and design patterns.
  Triggers on code review, quality audit, or refactoring suggestions.

  <example>
  Context: User wants code review
  user: "Review this module for code quality issues"
  assistant: "I'll use the code-quality-reviewer agent to analyze maintainability."
  </example>
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet
model: inherit
---

# Code Quality Reviewer

## Quality Dimensions
- **Readability**: Clear naming, logical structure, appropriate comments
- **Maintainability**: Low coupling, high cohesion, single responsibility
- **Testability**: Dependency injection, pure functions, clear interfaces
- **Performance**: Time/space complexity, resource usage

## Code Smells to Check
- Long methods (>50 lines), large classes (>500 lines)
- Deep nesting, switch statements, duplicate code
- Feature envy, inappropriate intimacy
```

## Deployment Agents

### Kubernetes Deployment Specialist

**File:** `agents/kubernetes-deployment.md`

```markdown
---
name: kubernetes-deployment
description: |
  Kubernetes deployment specialist for orchestrating container deployments.
  Triggers on k8s deployment, manifest generation, or rollback.

  <example>
  Context: User wants to deploy to kubernetes
  user: "Deploy the new version to the staging cluster"
  assistant: "I'll use the kubernetes-deployment agent to orchestrate the deployment."
  </example>
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Edit, Write, Bash
model: inherit
---

# Kubernetes Deployment Specialist

## Process
1. Pre-flight checks (cluster, nodes, resources)
2. Manifest generation (deployment, service, configmap)
3. Deployment execution (apply, rollout status)
4. Health validation (probes, endpoints, logs)
5. Rollback plan (rollout undo if needed)
```

## Research Agents

### Documentation Researcher

**File:** `agents/docs-researcher.md`

```markdown
---
name: docs-researcher
description: |
  Documentation researcher finding answers in official docs.
  Triggers on documentation lookup, API reference, or best practice research.

  <example>
  Context: User needs documentation
  user: "Find the official docs on React Server Components"
  assistant: "I'll use the docs-researcher agent to find and synthesize the documentation."
  </example>
tools: Glob, Grep, Read, Skill, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, WebSearch, WebFetch
model: inherit
---

# Documentation Researcher

## Source Priority
1. Official documentation sites
2. Official GitHub repositories
3. Official API references
4. Stack Overflow (accepted answers)
5. Community articles (recent, verified)

## Output: Sources with working code examples and version compatibility notes.
```

## Multi-Agent Workflows

### Feature Implementation

```
User: "Implement user authentication with JWT"
  1. Research Agent → Best practices, code examples
  2. Security Agent → Security requirements
  3. Implementation → JWT auth based on findings
  4. TDD Agent → Comprehensive test suite
  5. Security Agent → Audit implementation
  6. Quality Agent → Review maintainability
```

### Bug Fix

```
User: "Fix the authentication bug in production"
  1. Research Agent → Log analysis, error patterns
  2. Security Agent → Security incident assessment
  3. Quality Agent → Identify potential causes
  4. Fix → Implement fix
  5. TDD Agent → Regression tests
  6. Deployment Agent → Deploy with monitoring
```

### Code Review (Parallel)

```
User: "Review PR #123"
  ├─ Security Agent → Security findings
  ├─ Performance Agent → Performance concerns
  ├─ Quality Agent → Quality issues
  └─ Testing Agent → Coverage analysis
  → Aggregate unified feedback
```

---

# Commands

## Git Workflows

### Create Feature Branch

`.claude/commands/git/feature.md`:

```markdown
---
description: Create feature branch from issue number
argument-hint: <issue-number>
allowed-tools: Bash(git *), Bash(gh *)
---

Issue: #$1

## Issue Details
!`gh issue view $1 --json title,body,labels`

## Current State
Branch: !`git branch --show-current`

## Action
1. Ensure clean working directory
2. Pull latest from main
3. Create feature/$1 branch
4. Link to issue
```

### Commit Staged Changes

`.claude/commands/git/commit.md`:

```markdown
---
description: Create commit from staged changes with conventional format
allowed-tools: Bash(git *)
---

Branch: !`git branch --show-current`
Staged: !`git diff --staged --stat`
Diff: !`git diff --staged`
Recent: !`git log --oneline -5`

Create a conventional commit: `type(scope): description`
```

## Testing & QA

### Run Test Suite

`.claude/commands/test/run-all.md`:

```markdown
---
description: Run complete test suite with coverage
allowed-tools: Bash(bun *), Bash(npm *)
---

!`bun test 2>&1 || npm test 2>&1`

Summarize results: passes, failures, coverage gaps.
```

### Debug Failing Test

`.claude/commands/test/debug.md`:

```markdown
---
description: Debug specific failing test
argument-hint: <test-file-or-name>
allowed-tools: Read, Bash(bun *), Bash(npm *)
---

Test: $1
Result: !`bun test --filter "$1" 2>&1`

Identify root cause and suggest fixes.
```

## Deployment

### Deploy to Environment

`.claude/commands/deploy/to-env.md`:

```markdown
---
description: Deploy to specified environment with validation
argument-hint: <environment> [--skip-tests]
allowed-tools: Bash(*), Read
disable-model-invocation: true
---

Environment: $1

Pre-flight: validate environment, run tests (unless --skip-tests).
Requires explicit approval before proceeding.
```

## Code Review

### Review PR

`.claude/commands/review/pr.md`:

```markdown
---
description: Comprehensive PR review with checklist
argument-hint: <pr-number>
allowed-tools: Bash(gh *), Read, Grep
---

PR: #$1
Details: !`gh pr view $1 --json title,body,author,additions,deletions,files`
Diff: !`gh pr diff $1`

Review for: code quality, functionality, tests, security, performance, documentation.
```

## Documentation

### Generate API Docs

`.claude/commands/docs/api.md`:

```markdown
---
description: Generate API documentation from code
argument-hint: <file-or-directory>
allowed-tools: Read, Glob
---

Target: $1

For each public function/class/interface, document: description, parameters, return type, examples.
```

## Project Management

### Sprint Summary

`.claude/commands/project/sprint-summary.md`:

```markdown
---
description: Generate sprint summary from git and issue tracker
allowed-tools: Bash(git *), Bash(gh *)
---

Commits: !`git log --since="2 weeks ago" --pretty=format:"%h %s (%an)" --no-merges`
Contributors: !`git log --since="2 weeks ago" --pretty=format:"%an" --no-merges | sort | uniq -c | sort -rn`

Summarize: highlights, metrics, completed, in-progress, blockers.
```

## Development Workflows

### New Feature Setup

`.claude/commands/dev/new-feature.md`:

```markdown
---
description: Set up complete feature development workflow
argument-hint: <feature-name>
allowed-tools: Bash(git *), Write, Bash(gh *)
---

Feature: $1

1. Create issue
2. Create branch: feature/$1
3. Scaffold files (implementation, tests, types)
4. Begin TDD cycle
```

## Community Command Collections

- [wshobson/commands](https://github.com/wshobson/commands) — 57 production-ready commands
- [Claude Command Suite](https://github.com/qdhenry/Claude-Command-Suite) — 148+ commands
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — Curated collection

### Useful Patterns

**Context Priming** — Load project context after `/clear`:

```markdown
---
description: Prime context with project structure
---

!`tree -L 2 -I 'node_modules|.git|dist'`
@package.json
@tsconfig.json
!`git log --oneline -10`
```

**Fast Commit** — Auto-select commit message:

```markdown
---
description: Quick commit - auto-select first suggestion
allowed-tools: Bash(git *)
disable-model-invocation: true
---

!`git diff --staged --stat`
!`git log --oneline -3`

Generate and execute commit immediately.
```

---

# Configuration

## MCP Server Setup

### Basic Server

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/john/Documents"]
    }
  }
}
```

### Multiple Servers

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/john/Projects"]
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://localhost/mydb"
      }
    },
    "weather": {
      "command": "uv",
      "args": ["--directory", "/Users/john/weather-server", "run", "server.py"]
    }
  }
}
```

## Team Configuration

### .claude/settings.json

```json
{
  "extraKnownMarketplaces": {
    "company-core": {
      "source": {
        "source": "github",
        "repo": "company/core-plugins"
      }
    }
  },
  "enabledPlugins": ["project-workflow", "team-standards"]
}
```

## Environment-Specific Settings

### Using Environment Variables

```json
{
  "mcpServers": {
    "app-server": {
      "command": "node",
      "args": ["/absolute/path/to/server/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

### Cross-Platform Paths

Use absolute paths per platform:
- **macOS**: `/Users/john/tools-server`
- **Windows**: `C:/Users/john/tools-server`
- **Linux**: `/home/john/tools-server`

### Complete Team Setup

```
my-project/
├── .claude/
│   └── settings.json          # Team plugin config
├── .mcp.json                  # Project MCP servers
├── .env.example               # Required env vars template
└── README.md                  # Setup instructions
```

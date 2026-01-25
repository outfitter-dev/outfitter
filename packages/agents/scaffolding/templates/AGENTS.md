# AGENTS.md

Guidelines for AI agents and developers working in this repository.

## Project Overview

<!-- Brief description of what this project does -->

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build project
bun run test         # Run tests
bun run lint         # Check linting
bun run typecheck    # TypeScript validation
```

## Architecture

<!-- Key architectural decisions and patterns -->

## Development Principles

### TDD-First

1. **Red**: Write failing test that defines behavior
2. **Green**: Minimal code to pass
3. **Refactor**: Improve while green

### Code Style

- TypeScript strict mode
- Explicit types, avoid `any`

## Git Workflow

### Commits

Conventional Commits with scopes:
```
feat(scope): add feature
fix(scope): fix bug
```

### Pull Requests

- Clear summary and tests
- Short-lived branches off `main`

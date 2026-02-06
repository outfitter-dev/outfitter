---
name: docs-write
description: >-
  Project documentation structure and templates — READMEs, API docs, guides, and CLI references.
  Use when creating documentation, structuring a docs/ directory, writing READMEs, or when
  "documentation", "README", "API docs", "docs structure", or "guides" are mentioned.
  Pair with styleguide for writing craft; apply voice as a review pass.
metadata:
  version: "2.0.0"
  author: outfitter
  category: documentation
---

# Documentation Standards

Structure and templates for project documentation — the human-facing docs that help developers understand and use your project.

This skill covers *what* to include and *where* it goes. For *how* to write it:
- Load the `internal:styleguide` skill for sentence rhythm, metaphors, structural moves
- Load the `internal:voice` skill for philosophical foundation (apply as review pass)

For agent-specific documentation (CLAUDE.md, AGENTS.md), load the `internal:agent-docs` skill.

## Documentation Hierarchy

Documentation is prioritized in this order:

1. **Types** — Self-documenting code through TypeScript types
2. **Inline comments** — TSDoc/JSDoc for non-obvious decisions
3. **`docs/`** — Broader architectural and reference material

All three levels matter. Types express intent through code, comments explain why, and docs provide context.

## Project Directory Structure

Standardized directory layout for documentation across repositories.

### Root-Level Files

| File | Purpose |
|------|---------|
| `README.md` | Entry point for humans — quick start, links to docs |
| `CONTRIBUTING.md` | Contribution guidelines (if applicable) |
| `CHANGELOG.md` | Version history (auto-generated preferred) |

### Standard Directories

```
project/
└── docs/
    ├── architecture/        # System design, ADRs
    ├── api/                 # API reference (if applicable)
    ├── cli/                 # CLI command reference
    ├── guides/              # How-to guides, tutorials
    └── development/         # Dev setup, workflows
```

### Directory Purpose

| Directory | Content |
|-----------|---------|
| `architecture/` | System design docs, Architecture Decision Records (ADRs), diagrams |
| `api/` | API reference, endpoint documentation, type definitions |
| `cli/` | Command reference, flags, usage examples, exit codes |
| `guides/` | How-to tutorials, walkthroughs, use-case guides |
| `development/` | Contributing setup, local dev, testing, release process |

### Source of Truth Principle

Each type of documentation should have one canonical location:

- **API reference** → Generated from code or `docs/api/`
- **CLI reference** → `docs/cli/` or generated from help text
- **Architecture decisions** → `docs/architecture/` or ADRs

Avoid duplicating content across locations. Link instead of copy.

## README Standards

READMEs are the entry point for new contributors. Keep them focused and scannable.

### Structure Template

```markdown
# Project Name

One-line description of what this does.

## Why [Project Name]?

Brief explanation of the problem this solves (2-3 sentences).

## Quick Start

Minimal steps to get running:

\`\`\`bash
# Installation
bun add project-name

# Basic usage
bun run project-name
\`\`\`

## Features

- Feature 1 — brief description
- Feature 2 — brief description
- Feature 3 — brief description

## Documentation

- [Getting Started](./docs/guides/getting-started.md)
- [API Reference](./docs/api/)
- [CLI Reference](./docs/cli/)
- [Architecture](./docs/architecture/)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT
```

### Length Guidelines

- **Target**: 150-250 lines
- **Maximum**: 400 lines (beyond this, extract to `docs/`)
- **Minimum**: 50 lines (needs at least: description, install, usage)
- **Flexible**: As long as needed for pain, value prop, quick starts, doc pointers

### What Belongs in README vs docs/

| README | `docs/` |
|--------|---------|
| Quick start (5-10 steps max) | Full tutorials |
| Feature list (bullet points) | Feature deep-dives |
| Installation options | Configuration reference |
| Links to detailed docs | The detailed docs themselves |

### Leading Section Pattern

Choose based on project type:

- **Libraries/Tools**: Lead with "Quick Start" — users want to try it immediately
- **Frameworks/Platforms**: Lead with "Why X?" — users need to understand the value proposition
- **Internal Tools**: Lead with "Usage" — users already know why, they need how

### Stability Tier Labels

When documenting packages or components with different maturity levels, use these labels:

| Label | Meaning | Guidance |
|-------|---------|----------|
| **Stable** | APIs locked, breaking changes rare | Safe to depend on |
| **Active** | APIs evolving based on usage | Watch for updates |
| **Early** | APIs will change, not production-ready | Use with caution |

Avoid metaphorical labels (Cold/Warm/Hot, etc.) — literal labels require no interpretation.

### Quick Start Best Practices

1. **Make it copy-paste runnable.** Use heredoc format when showing file creation:
   ```bash
   cat > example.ts << 'EOF'
   import { ok, err } from '@org/contracts';
   // ... code
   EOF
   bun run example.ts
   ```

2. **Show output, including errors.** Demonstrate both success and failure:
   ```
   $ my-tool search --query "test"
   Found: [ "result-1", "result-2" ]

   $ my-tool search
   Error [validation]: Query is required
   ```
   Showing error output proves your error handling works.

3. **End with a memorable closer.** After the output block, add a confident one-liner:
   ```markdown
   **Output:**
   \`\`\`
   Found: [ "result-1", "result-2" ]
   \`\`\`

   Done. You're building type-safe infrastructure.
   ```

4. **Use domain-relevant examples.** Avoid generic "Hello, World!" — use examples that demonstrate actual value.

## CLI Documentation

For projects with CLIs, document commands in `docs/cli/`.

### Command Reference Template

```markdown
# command-name

Brief description of what this command does.

## Synopsis

\`\`\`
my-tool command [options] <required-arg> [optional-arg]
\`\`\`

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<required-arg>` | Yes | What this argument controls |
| `[optional-arg]` | No | What this optional argument does |

## Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--verbose` | `-v` | `false` | Enable verbose output |
| `--output` | `-o` | `stdout` | Output destination |

## Examples

\`\`\`bash
# Basic usage
my-tool command input.txt

# With options
my-tool command -v --output result.json input.txt
\`\`\`

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
```

## Document Structure

Every technical document should include:

```markdown
# [Feature/Component Name]

Brief description of what this covers and why it matters.

## Overview

High-level explanation of the concept or component.

## Usage

How to use this in practice, with examples.

## API Reference (if applicable)

Detailed parameter and return value documentation.

## Examples

Complete, working code examples.

## Common Patterns

Typical use cases and recommended approaches.

## Troubleshooting (if applicable)

Common issues and their solutions.
```

### Heading Hierarchy

- **H1 (#)**: Document title only
- **H2 (##)**: Major sections
- **H3 (###)**: Subsections
- **H4 (####)**: Specific topics within subsections
- Avoid deeper nesting than H4

## Code Examples

### Requirements

- Include all necessary imports
- Show both definition and usage
- Add brief comments for complex logic
- Ensure examples are runnable
- Test examples before documenting

### Good Example

```typescript
interface UserConfig {
  timeout: number;
  retries: number;
}

function configureUser(options: UserConfig): void {
  // Validate timeout is positive
  if (options.timeout <= 0) {
    throw new Error('Timeout must be positive');
  }
  applyConfig(options);
}

// Usage
configureUser({ timeout: 5000, retries: 3 });
```

### Bad Example

```typescript
// Incomplete, lacks context
function configure(opts) {
  // ...
}
```

## API Documentation

### Function Documentation

```typescript
/**
 * Processes user data according to specified rules.
 *
 * @param userData - The raw user data to process
 * @param rules - Processing rules to apply
 * @returns Processed user data with applied transformations
 *
 * @example
 * ```typescript
 * const processed = processUser(
 *   { name: 'John', age: 30 },
 *   { uppercase: true }
 * );
 * // Returns: { name: 'JOHN', age: 30 }
 * ```
 *
 * @throws {ValidationError} When userData is invalid
 * @throws {RuleError} When rules cannot be applied
 */
function processUser(userData: UserData, rules: ProcessRules): ProcessedUser
```

### Parameter Documentation

Always document:

- **Type**: Explicit TypeScript types
- **Purpose**: What the parameter controls
- **Constraints**: Valid ranges, formats, or values
- **Defaults**: If applicable
- **Examples**: For complex types

## Configuration Tables

```markdown
| Option    | Type      | Default | Description                     |
|-----------|-----------|---------|--------------------------------|
| `port`    | `number`  | `3000`  | Server port                    |
| `timeout` | `number`  | `30000` | Request timeout in milliseconds |
| `debug`   | `boolean` | `false` | Enable debug logging           |
```

## Maintenance

1. **Update with code**: Documentation changes must accompany code changes
2. **Review regularly**: Audit documentation quarterly for accuracy
3. **Remove outdated content**: Delete obsolete information rather than marking as deprecated
4. **Version appropriately**: Clearly document breaking changes and migration paths
5. **Test examples**: Verify all code examples work with current versions

## Review Checklist

Before finalizing documentation:

- [ ] All code examples are tested and working
- [ ] Technical terms are defined or linked
- [ ] Structure follows the standard template
- [ ] No outdated information remains
- [ ] Examples cover common use cases
- [ ] Error scenarios are documented
- [ ] API signatures are complete
- [ ] Cross-references are valid

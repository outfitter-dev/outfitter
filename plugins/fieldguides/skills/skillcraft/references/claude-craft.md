# Claude Code Extensions

For comprehensive Claude Code skill development — including `allowed-tools`, `context` modes, `argument-hint`, model overrides, hooks, and string substitutions — load the `claude-craft` skill.

This reference previously contained the full Claude Code extension documentation. That content now lives in the consolidated `claude-craft` skill:

| Topic | Location |
|-------|----------|
| Frontmatter extensions | `claude-craft` → Skills section |
| Tool restrictions | `claude-craft` → [skills/integration.md](../../claude-craft/references/skills/integration.md) |
| Context modes (fork/inherit) | `claude-craft` → [skills/context-modes.md](../../claude-craft/references/skills/context-modes.md) |
| String substitutions | `claude-craft` → Skills section |
| Performance tips | `claude-craft` → [skills/performance.md](../../claude-craft/references/skills/performance.md) |
| Hook integration | `claude-craft` → Hooks section |
| Command integration | `claude-craft` → Commands section |
| Testing & debugging | `claude-craft` → Testing & Debugging section |

## Quick Reference

```yaml
# Claude Code-specific frontmatter fields
allowed-tools: Read, Grep, Glob, Bash(git *)   # Tool permissions (comma-separated)
user-invocable: true                         # Allow /skill-name invocation
context: fork                                # Isolated execution
agent:analyst                     # Agent for forked context
model: sonnet                                # Model override
argument-hint: [file or directory]           # Autocomplete hint
```

For the cross-platform Agent Skills spec, load the `skillcraft` skill.

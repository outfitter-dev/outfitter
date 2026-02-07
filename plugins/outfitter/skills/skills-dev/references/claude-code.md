# Claude Code Extensions

For comprehensive Claude Code skill development — including `allowed-tools`, `context` modes, `argument-hint`, model overrides, hooks, and string substitutions — load the `outfitter:claude-code` skill.

This reference previously contained the full Claude Code extension documentation. That content now lives in the consolidated `claude-code` skill:

| Topic | Location |
|-------|----------|
| Frontmatter extensions | `outfitter:claude-code` → Skills section |
| Tool restrictions | `outfitter:claude-code` → [skills/integration.md](../../claude-code/references/skills/integration.md) |
| Context modes (fork/inherit) | `outfitter:claude-code` → [skills/context-modes.md](../../claude-code/references/skills/context-modes.md) |
| String substitutions | `outfitter:claude-code` → Skills section |
| Performance tips | `outfitter:claude-code` → [skills/performance.md](../../claude-code/references/skills/performance.md) |
| Hook integration | `outfitter:claude-code` → Hooks section |
| Command integration | `outfitter:claude-code` → Commands section |
| Testing & debugging | `outfitter:claude-code` → Testing & Debugging section |

## Quick Reference

```yaml
# Claude Code-specific frontmatter fields
allowed-tools: Read Grep Glob Bash(git *)   # Tool permissions
user-invocable: true                         # Allow /skill-name invocation
context: fork                                # Isolated execution
agent: outfitter:analyst                     # Agent for forked context
model: sonnet                                # Model override
argument-hint: [file or directory]           # Autocomplete hint
```

For the cross-platform Agent Skills spec, load the `outfitter:skills-dev` skill.

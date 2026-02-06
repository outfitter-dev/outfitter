# Claude Code Guidance

Claude Code-specific conventions for this repository. For project context, see [AGENTS.md](../AGENTS.md).

## Task Management

Use task tools to track work across context windows. Tasks survive context compaction.

### Creating Tasks

Use `TaskCreate` for multi-step work:
- `subject`: Imperative form ("Run tests", "Fix validation bug")
- `activeForm`: Present continuous shown in spinner ("Running tests")
- `description`: Detailed requirements and acceptance criteria

### Updating Tasks

Use `TaskUpdate` to manage task lifecycle:
- Set `status: "in_progress"` before starting work
- Set `status: "completed"` only when fully done
- Keep exactly one task `in_progress` at a time

### Dependencies

Use `addBlocks` and `addBlockedBy` to express task ordering:
- `addBlockedBy: ["task-id"]` — This task cannot start until the specified tasks complete
- `addBlocks: ["task-id"]` — The specified tasks cannot start until this one completes

Check `TaskList` to find unblocked tasks ready for work.

### Best Practices

- Create tasks immediately when receiving multi-step instructions
- Add discovered follow-up tasks during implementation
- Never mark a task completed if tests fail or implementation is partial
- Use `TaskGet` to read full task details before starting work

## Key References

- [AGENTS.md](../AGENTS.md) — Full development guide
- [docs/PATTERNS.md](../docs/PATTERNS.md) — Handler contract, Result types
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — Package relationships

# Claude-Specific Guidance

## Task Management

Use the task tools to track work across context windows.

### Creating Tasks

Use `TaskCreate` for multi-step work:
- `subject`: Imperative form ("Run tests")
- `activeForm`: Present continuous ("Running tests")
- `description`: Detailed requirements

### Best Practices

- Create tasks immediately when receiving multi-step instructions
- Keep exactly one task `in_progress` at a time
- Never mark completed if tests fail

## Preferred Tools

- Use `gt` for version control, not raw `git`
- Prefer `Grep` tool over bash grep
- Use `Read` tool instead of `cat`

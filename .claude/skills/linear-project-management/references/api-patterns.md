# Linear API Patterns

Complete API reference for Linear operations. Covers MCP tool selection, GraphQL recipes, and common gotchas.

## Available MCP Tools

Two Linear MCP servers are typically available:

### Typed tools: `mcp__claude_ai_Linear__*`

Structured tools for common CRUD operations. Use these as the default:

- **Issues**: `create_issue`, `update_issue`, `get_issue`, `list_issues`
- **Projects**: `create_project`, `update_project`, `get_project`, `list_projects`
- **Milestones**: `create_milestone`, `update_milestone`, `get_milestone`, `list_milestones`
- **Labels**: `create_issue_label`, `list_issue_labels`, `list_project_labels`
- **Documents**: `create_document`, `update_document`, `get_document`, `list_documents`
- **Comments**: `list_comments`, `create_comment`
- **Teams**: `list_teams`, `get_team`
- **Users**: `list_users`, `get_user`
- **Cycles**: `list_cycles`
- **Statuses**: `list_issue_statuses`, `get_issue_status`
- **Initiatives**: `list_initiatives`, `get_initiative`, `create_initiative`, `update_initiative`
- **Status updates**: `get_status_updates`, `save_status_update`, `delete_status_update`

### General-purpose tool: `mcp__linear__linear`

Single tool with an `action` parameter. Supports: `search`, `get`, `update`, `comment`, `create`, `graphql`, `help`.

Use this when:

- Typed tools don't cover the operation
- You need custom GraphQL queries or mutations
- You need to discover team keys or workflow states (`action: "help"`)

## Loading Deferred Tools

All Linear MCP tools are deferred. You must load them before calling:

```text
ToolSearch with query: "+linear create issue"
ToolSearch with query: "+linear project"
```

The `+linear` prefix ensures only Linear tools are returned.

## GraphQL Escape Hatch

When typed tools don't cover an operation, use `mcp__linear__linear` with `action: "graphql"`.

### Project Status Updates

Typed tools (`save_status_update`) can post project status updates, but GraphQL gives more control over formatting and fields. Use GraphQL when you need custom health values or rich markdown bodies:

```json
{
  "action": "graphql",
  "graphql": "mutation { projectUpdateCreate(input: { projectId: \"PROJECT_ID\", health: onTrack, body: \"## What's changed\\n\\n- Completed milestone 1\\n- Started work on CLI commands\" }) { success projectUpdate { id url } } }"
}
```

**Health enum values** (must be unquoted — they're GraphQL enums, not strings):

- `onTrack`
- `atRisk`
- `offTrack`

### Finding Project IDs

By name:

```json
{
  "action": "graphql",
  "graphql": "query { projects(filter: { name: { containsIgnoreCase: \"project name\" } }) { nodes { id name state } } }"
}
```

By team (find projects associated with a team):

```json
{
  "action": "graphql",
  "graphql": "query { team(id: \"TEAM_ID\") { projects { nodes { id name state } } } }"
}
```

Use `action: "help"` on `mcp__linear__linear` to discover team IDs and keys.

### Listing Project Updates

```json
{
  "action": "graphql",
  "graphql": "query { project(id: \"PROJECT_ID\") { projectUpdates { nodes { id body health createdAt } } } }"
}
```

### Creating Milestones via GraphQL

When the typed `create_milestone` tool doesn't fit your needs:

```json
{
  "action": "graphql",
  "graphql": "mutation { projectMilestoneCreate(input: { projectId: \"PROJECT_ID\", name: \"Foundation\", description: \"Core types and contracts\" }) { success projectMilestone { id name } } }"
}
```

### Assigning Issues to Milestones

```json
{
  "action": "graphql",
  "graphql": "mutation { issueUpdate(id: \"ISSUE_ID\", input: { projectMilestoneId: \"MILESTONE_ID\" }) { success issue { id title } } }"
}
```

### Comments via GraphQL

Use GraphQL `commentCreate` for comments with markdown formatting. The `comment` action on `mcp__linear__linear` passes `\n` as literal text instead of newlines.

```json
{
  "action": "graphql",
  "graphql": "mutation { commentCreate(input: { issueId: \"ISSUE_ID\", body: \"## Status Update\\n\\nCompleted the initial implementation.\\n\\nNext steps:\\n- Add tests\\n- Update docs\" }) { success comment { id url } } }"
}
```

### Issue Dependencies

Set blocking relationships between issues:

```json
{
  "action": "graphql",
  "graphql": "mutation { issueRelationCreate(input: { issueId: \"BLOCKING_ISSUE_ID\", relatedIssueId: \"BLOCKED_ISSUE_ID\", type: blocks }) { success } }"
}
```

### Bulk Operations

List all issues in a project:

```json
{
  "action": "graphql",
  "graphql": "query { project(id: \"PROJECT_ID\") { issues { nodes { id title state { name } assignee { name } projectMilestone { name } } } } }"
}
```

List issues by label:

```json
{
  "action": "graphql",
  "graphql": "query { issues(filter: { labels: { name: { eq: \"@outfitter/cli\" } } }) { nodes { id title state { name } } } }"
}
```

## Workflow: Choosing the Right Tool

```text
Need to do X with Linear
    │
    ├── Is there a typed tool? (mcp__claude_ai_Linear__*)
    │   ├── Yes → Use it (simpler, typed, less error-prone)
    │   └── No → Use mcp__linear__linear
    │       │
    │       ├── Simple get/update/search → Use action parameter
    │       └── Custom query/mutation → Use action: "graphql"
    │
    └── Don't know what's available?
        └── Use action: "help" on mcp__linear__linear
```

## Gotchas

### Enum values are unquoted

GraphQL enums must not be quoted. `health: onTrack` not `health: "onTrack"`. Quoting produces a "cannot represent non-enum value" error.

Other enum fields that follow this pattern:

- Issue relation type: `blocks`, `duplicate`, `related`
- Priority: `urgent`, `high`, `medium`, `low`, `none`

### Comments: `commentCreate` not `comment` action

The `comment` action on `mcp__linear__linear` passes `\n` as literal backslash-n text instead of newlines. Always use GraphQL `commentCreate` mutation for formatted comments.

### Markdown in body fields

The `body` field accepts markdown. When embedding in GraphQL strings:

- Escape double quotes: `\"`
- Use `\\n` for newlines (escaped once for JSON, once for the GraphQL string)

### Angle brackets in links

Linear's storage wraps URLs in angle brackets internally: `[text](<url>)`. This can break rendering in certain markdown contexts. Prefer bare URLs for Linear-to-Linear references.

### Team keys and workflow states

Use `action: "help"` on `mcp__linear__linear` to discover:

- Available teams and their keys (e.g., `OS` for Stack)
- Workflow states per team (e.g., `Backlog`, `Todo`, `In Progress`, `Done`)

### Deferred tools

Linear MCP tools are deferred and must be loaded via `ToolSearch` before calling. Calling without loading will fail.

### Project content vs project documents

- **Project content** (the description field): Set via `update_project` with the `content` parameter. This is where the PRD goes.
- **Project documents**: Separate entities linked to a project. Use for supplementary material, not the main PRD.

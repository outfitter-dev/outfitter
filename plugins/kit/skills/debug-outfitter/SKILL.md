---
name: debug-outfitter
version: 0.2.0
description: "Systematic debugging process for @outfitter/* package issues. Use when debugging Result handling, MCP problems, CLI output, exit codes, logging, or unexpected behavior. Produces structured investigation reports with root cause analysis."
allowed-tools: Read Grep Glob Bash(bun *) Bash(rg *)
---

# Debug Outfitter

Systematic debugging process for @outfitter/* package issues.

## Goal

Investigate issues methodically and produce a structured report documenting:
1. What was observed (symptoms)
2. What was investigated (evidence)
3. What was found (root cause)
4. What to do about it (fix or escalation)

## Constraints

**DO:**
- Gather evidence before forming hypotheses
- Use the diagnostic patterns in this skill
- Reference `outfitter-fieldguide` for correct patterns
- Assign a confidence level to your diagnosis
- Produce a Debug Report at the end

**DON'T:**
- Apply random fixes hoping something works
- Skip the evidence collection phase
- Leave issues undiagnosed
- Forget to document findings

## Steps

1. Load the `kit:outfitter-fieldguide` skill to gain expertise in the Outfitter packages.
2. [Collect evidence](#stage-1-evidence-collection) — gather symptoms before hypothesizing
3. [Categorize the issue](#stage-2-categorize-the-issue) — identify which area is affected
4. [Investigate](#stage-3-targeted-investigation) — use category-specific diagnostics
5. Produce a [Debug Report](#stage-4-document-findings) using [TEMPLATE.md](TEMPLATE.md)
6. If the issue is in Outfitter's packages themselves, [escalate](#when-to-escalate) via `kit:outfitter-feedback`

## Stage 1: Evidence Collection

Gather symptoms before forming hypotheses.

### What to Collect

- Error messages and stack traces
- Unexpected output vs expected output
- Exit codes (actual vs expected)
- Relevant code snippets
- Environment details (Bun version, package versions)

### Quick Diagnostic Commands

```bash
# Check package versions
bun pm ls | grep @outfitter

# Find Result usage patterns
rg "Result\.(ok|err)" --type ts -A 2

# Find error handling
rg "isErr\(\)|isOk\(\)" --type ts -A 3

# Check for thrown exceptions (anti-pattern)
rg "throw new" --type ts
```

## Stage 2: Categorize the Issue

Based on symptoms, identify the issue category:

| Category | Symptoms | Common Causes |
|----------|----------|---------------|
| **Result Handling** | Wrong value, type errors | Missing await, reassignment breaking narrowing |
| **MCP Issues** | Tool not appearing, invocation failing | Registration order, missing schema descriptions |
| **CLI Output** | Wrong format, missing data | Mode detection, await on output |
| **Exit Codes** | Wrong exit code | Not using `exitWithError`, manual `process.exit` |
| **Logging** | Missing logs, sensitive data exposed | Wrong level, redaction disabled |
| **Validation** | Unexpected validation errors | Schema mismatch, missing `.describe()` |

## Stage 3: Targeted Investigation

### Result Handling Issues

**Always getting error:**
```typescript
// Check: Missing await?
const result = getUser(id);  // ❌ Promise, not Result!
const result = await getUser(id);  // ✅

// Check: Validation failing?
const validated = validate(input);
if (validated.isErr()) {
  console.log("Validation failed:", validated.error.details);
}
```

**Type narrowing broken:**
```typescript
// ❌ Reassigning breaks narrowing
let result = await getUser(id);
if (result.isOk()) {
  result = await updateUser(result.value);  // Breaks!
}

// ✅ Separate variables
const getResult = await getUser(id);
if (getResult.isErr()) return getResult;
const updateResult = await updateUser(getResult.value);
```

**Error type lost:**
```typescript
// Use _tag for narrowing
if (result.isErr()) {
  switch (result.error._tag) {
    case "ValidationError":
      console.log(result.error.details);
      break;
    case "NotFoundError":
      console.log(result.error.resourceId);
      break;
  }
}
```

### MCP Issues

**Tool not appearing:**
1. Verify registration happens before `start()`:
   ```typescript
   server.registerTool(myTool);
   server.start();  // After registration!
   ```

2. Check schema has `.describe()` on all fields:
   ```typescript
   const schema = z.object({
     query: z.string().describe("Required for AI"),
   });
   ```

**Tool invocation failing:**
1. Handler must be async:
   ```typescript
   handler: async (input) => {  // Not sync!
     return Result.ok(data);
   }
   ```

2. Must return Result:
   ```typescript
   // ❌ return { data: "value" };
   // ✅ return Result.ok({ data: "value" });
   ```

### CLI Output Issues

**JSON not printing:**
```typescript
// Force mode
await output(data, { mode: "json" });

// Check environment
// OUTFITTER_JSON=1 forces JSON
// OUTFITTER_JSON=0 forces human (even with --json flag)

// Await output before exit
await output(data);  // ✅
// process.exit(0);  // May exit before output completes
```

**Wrong exit code:**
```typescript
// ❌ process.exit(1);
// ✅ exitWithError(result.error);
```

Exit code reference:
| Category | Exit |
|----------|------|
| validation | 1 |
| not_found | 2 |
| conflict | 3 |
| permission | 4 |
| timeout | 5 |
| rate_limit | 6 |
| network | 7 |
| internal | 8 |
| auth | 9 |
| cancelled | 130 |

### Logging Issues

**Redaction not working:**
```typescript
const logger = createLogger({
  redaction: { enabled: true },  // Must be true!
  // Custom patterns
  redaction: {
    enabled: true,
    patterns: ["password", "apiKey", "myCustomSecret"],
  },
});
```

**Missing context:**
```typescript
const requestLogger = createChildLogger(ctx.logger, {
  requestId: ctx.requestId,
  handler: "myHandler",
});
requestLogger.info("Processing", { data });  // Includes requestId
```

**Wrong level:**
```typescript
// Hierarchy: trace < debug < info < warn < error < fatal
// "info" hides trace and debug
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
});
```

## Stage 4: Document Findings

Assess confidence in your diagnosis:

| Confidence | Meaning |
|------------|---------|
| **High** | Clear pattern violation or bug found with evidence |
| **Medium** | Likely cause identified, may need verification |
| **Low** | Multiple possibilities remain, needs more investigation |

Based on diagnosis, recommend:
- **Code fix** — Provide specific fix with before/after
- **Pattern guidance** — Reference correct pattern from fieldguide
- **Escalation** — If issue is in Outfitter itself, use `outfitter-feedback`

Produce a Debug Report using [TEMPLATE.md](TEMPLATE.md).

## When to Escalate

If investigation reveals an issue in @outfitter/* packages themselves (not user code):

1. Document the issue clearly in the Debug Report
2. Recommend using `kit:outfitter-feedback` skill to file an issue
3. Include reproduction steps and expected vs actual behavior

## Related Skills

- `kit:outfitter-fieldguide` — Correct patterns reference
- `kit:outfitter-check` — Compliance verification
- `kit:outfitter-feedback` — Report issues to Outfitter team

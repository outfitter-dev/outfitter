---
name: library-worker
description: Implements code changes in the Outfitter monorepo — bug fixes, utilities, testing primitives, refactors.
---

# Library Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that involve writing or modifying TypeScript code in the monorepo:

- Bug fixes in existing packages
- New utility functions and helpers
- Testing primitives and harnesses
- Refactors (e.g., centralizing logic, returning Result instead of throwing)

## Work Procedure

### 1. Understand the Feature

- Read the feature description thoroughly — it references a Linear issue with specific requirements.
- Read `AGENTS.md` for mission boundaries, coding conventions, and key source files.
- Read the relevant source files listed in the feature's `preconditions` to understand existing code.
- Read `.factory/library/architecture.md` for cross-package patterns.

### 2. Write Failing Tests (Red Phase)

- Create or update test file at `src/__tests__/<feature>.test.ts` in the relevant package.
- Write tests that define the expected behavior from the feature description's `expectedBehavior`.
- Cover: happy path, error cases, edge cases, type narrowing (if applicable).
- Run `bun test` in the package directory to confirm tests FAIL (red).
- If tests pass before implementation, your tests aren't testing the new behavior.

### 3. Implement (Green Phase)

- Write the minimal code to make tests pass.
- Follow existing patterns in the package (check neighboring files for style).
- Use `Result<T, E>` from `better-result`, not exceptions.
- Use Bun-native APIs where applicable.
- Ensure the function is exported from the package's public API (add to `src/index.ts` or relevant subpath export).

### 4. Refactor

- Clean up while tests are green.
- Remove any dead code or unused imports.
- Ensure consistent naming with the rest of the package.

### 5. Verify

Run these commands and report EXACT output in your handoff:

```bash
# Package-level tests
cd packages/<pkg> && bun test

# Full suite (catches cross-package breakage)
bun run test

# Type safety
bun run typecheck

# Lint + format
bun run check
```

Fix any failures before completing. If `bun run check` reports formatting issues, run `bun run format:fix` and verify again.

### 6. Export Verification

Verify the new API is importable:

```bash
bun -e "const m = await import('@outfitter/<pkg>'); console.log(typeof m.<newExport>)"
```

This must print `function` (or `object` for types). If it prints `undefined`, the export is missing.

### 7. Changeset

If the change modifies a published package's runtime behavior or API:

```bash
bun changeset
```

Select the affected package(s), choose the appropriate bump level (patch for fixes, minor for new features), and write a concise description.

### 8. Commit

Commit with conventional commit format referencing the Linear issue:

```
feat(contracts): add parseInput() Zod-to-Result helper [OS-332]
```

## Example Handoff

```json
{
  "salientSummary": "Implemented parseInput<T>(schema, data) in @outfitter/contracts returning Result<T, ValidationError>. TDD: wrote 6 tests (valid input, invalid input, nested schema, optional fields, array schema, error message format), all passing. Verified export from @outfitter/contracts, full suite green (3280 pass), typecheck clean.",
  "whatWasImplemented": "parseInput<T>(schema, data) function in packages/contracts/src/validation.ts. Wraps Zod safeParse into Result<T, ValidationError> with formatted error messages. Exported from @outfitter/contracts root and @outfitter/contracts/validation subpath. Added changeset (minor bump).",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "cd packages/contracts && bun test",
        "exitCode": 0,
        "observation": "47 tests passed including 6 new parseInput tests"
      },
      {
        "command": "bun run test",
        "exitCode": 0,
        "observation": "3280 tests passed, 0 failed"
      },
      {
        "command": "bun run typecheck",
        "exitCode": 0,
        "observation": "No errors"
      },
      { "command": "bun run check", "exitCode": 0, "observation": "Clean" },
      {
        "command": "bun -e \"const m = await import('@outfitter/contracts'); console.log(typeof m.parseInput)\"",
        "exitCode": 0,
        "observation": "function"
      }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "packages/contracts/src/__tests__/parse-input.test.ts",
        "cases": [
          {
            "name": "returns Ok with parsed value for valid input",
            "verifies": "happy path"
          },
          {
            "name": "returns Err with ValidationError for invalid input",
            "verifies": "error case"
          },
          {
            "name": "preserves Zod error details in ValidationError message",
            "verifies": "error format"
          },
          {
            "name": "infers generic T from schema",
            "verifies": "type narrowing"
          },
          {
            "name": "handles nested object schemas",
            "verifies": "complex input"
          },
          {
            "name": "handles optional fields correctly",
            "verifies": "edge case"
          }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature depends on an API or type that doesn't exist yet in a different package
- The existing code structure doesn't match what the feature description assumes (e.g., file doesn't exist, different API shape)
- Tests reveal a bug in a different package that blocks this feature
- The feature's scope is significantly larger than described (>200 LOC implementation)
- `bun run test` or `bun run typecheck` fails on unrelated code and you cannot proceed

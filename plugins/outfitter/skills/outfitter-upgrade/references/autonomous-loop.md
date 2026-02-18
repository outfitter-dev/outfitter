# Autonomous Upgrade Loop

Detailed reference for agent-driven autonomous package migration.

## Prerequisites

- `outfitter` CLI is available (installed globally or via `bunx outfitter`)
- Working test suite (`bun test` passes before starting)
- Clean git state (no uncommitted changes)

## Full Workflow

### Phase 1: Discovery

```bash
outfitter upgrade --json
```

Parse the JSON output to build an update plan:

```typescript
const result = JSON.parse(output);

// Check if there's anything to do
if (result.updatesAvailable === 0) {
  // All packages are current — done
}

// Categorize updates
const breaking = result.packages.filter(p => p.breaking && p.updateAvailable);
const safe = result.packages.filter(p => !p.breaking && p.updateAvailable);
```

### Phase 2: Apply Safe Updates

```bash
# Apply non-breaking updates first
outfitter upgrade --yes --json
```

This bumps versions in `package.json`, runs `bun install`, and executes any mechanical codemods. The `--json` flag returns structured results:

```json
{
  "applied": true,
  "appliedPackages": ["@outfitter/contracts", "@outfitter/logging"],
  "skippedBreaking": ["@outfitter/cli"],
  "codemods": {
    "codemodCount": 0,
    "changedFiles": [],
    "errors": []
  }
}
```

### Phase 3: Apply Breaking Updates

If breaking changes exist and the agent has enough context:

```bash
outfitter upgrade --all --yes --json
```

This includes breaking packages in the update. Codemods run automatically for any changes that have codemod scripts.

### Phase 4: Manual Migration

After upgrading, check the guides for remaining changes:

```bash
outfitter upgrade --guide --json
```

For each guide with a `changes` array, process changes that don't have a `codemod` field:

```
for each guide in result.guides:
  for each change in guide.changes:
    if change.codemod exists:
      skip (already handled by upgrade)
    else:
      apply change manually based on change.type
```

#### Change Type Actions

**`moved`** — Import path changed:
```typescript
// Before
import { renderTable } from "@outfitter/cli/render";
// After
import { renderTable } from "@outfitter/tui/render";
```

Use Grep to find all occurrences of `change.from`, replace with `change.to`.

**`renamed`** — Export name changed:
```typescript
// Before
import { formatOutput } from "@outfitter/cli";
// After
import { renderOutput } from "@outfitter/cli";
```

Find-and-replace `change.from` with `change.to` across the codebase.

**`removed`** — Export no longer exists:
Read `change.detail` for the recommended alternative. Search for usages of `change.from` and replace.

**`signature-changed`** — Function signature updated:
Read `change.detail` for the new signature. Update all call sites.

**`deprecated`** — Still works but will be removed:
Optionally migrate now. Add a TODO comment if deferring.

**`added`** — New API available:
Informational only. No action required.

### Phase 5: Test Verification Loop

```bash
bun test
```

If tests fail:

1. Read the failure output carefully
2. Identify which package's migration caused the failure
3. Re-read the migration guide for that package: `outfitter upgrade --guide @outfitter/<pkg>`
4. Apply the fix
5. Re-run tests

Repeat up to 3 times. If still failing, escalate with:
- The test failure output
- Which migration step was being applied
- What you tried to fix it

### Phase 6: Compliance Check

When tests are green:

1. Load the `outfitter-check` skill
2. Run the compliance scan
3. Address any findings related to the updated packages

## Rollback

If the update cannot be completed:

```bash
# Discard all changes
git checkout -- .
bun install
```

Report what failed and why so the user can decide next steps.

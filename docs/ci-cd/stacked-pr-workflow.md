# Stacked PR Workflow — Schema Drift Prevention

Guardrails and triage playbook for stacked-branch workflows.
Covers schema drift, surface map enforcement, and shared-failure diagnosis.

## Root Cause Summary (OS-441)

During the simplification stack (PRs #607–#621), a TypeScript typing change in
`apps/outfitter/src/actions/docs.ts` altered the serialized schema shape. The
change was subtle — `optional` vs `union(undefined)` and readonly array effects
— but it caused `.outfitter/surface.json` to diverge from the live runtime.

**Why CI failed everywhere:** Every branch in the stack inherited the stale
surface map. When CI ran `outfitter schema diff` (via `verify:ci`), it detected
drift in every PR simultaneously.

**Why it was detected late:**

1. **Pre-commit hooks do not check schema drift.** They cover formatting,
   typecheck, and exports — not surface map freshness.
2. **Pre-push hooks run schema diff, but `gt stack submit` may bypass them.**
   Graphite submits all branches in a batch; if the developer pushes from a
   branch that predates the schema-changing commit, the hook may pass on that
   branch while downstream branches silently inherit the stale map.
3. **No explicit pre-submit gate exists.** There was no documented or scripted
   step to regenerate and verify the surface map before submitting a stack.
4. **Schema changes are invisible in code review.** A type narrowing that
   changes `optional` to `union(undefined)` does not look like a schema change
   in a diff. The surface map is the only reliable signal.

## Enforcement Points

| Gate                    | What runs                                               | Schema drift checked? |
| ----------------------- | ------------------------------------------------------- | --------------------- |
| Pre-commit (`lefthook`) | Ultracite fix, typecheck on staged `.ts` files, exports | No                    |
| Pre-push (`lefthook`)   | TDD-aware verification + `outfitter schema diff`        | Yes                   |
| CI (`verify:ci`)        | Full orchestrator including `schema-diff` step          | Yes                   |
| `verify:stack` (manual) | Schema generate, git status check, pre-push checks      | Yes                   |

**Known bypass paths:**

- `gt stack submit` does not always trigger pre-push hooks for every branch.
- `--no-verify` flag on `git push` skips all hooks.
- Force-pushing a branch that was previously clean may skip the hook if there
  are no new local commits.

## Required Pre-Submit Sequence for Stacked Branches

Before running `gt submit` or `gt stack submit`, run:

```bash
bun run verify:stack
```

This script performs three steps:

1. **`outfitter schema generate`** — Regenerates `.outfitter/surface.json`
   from the live runtime.
2. **Git status check** — If the surface map changed, the script exits with an
   error and instructions to commit the updated file.
3. **`outfitter check --pre-push`** — Runs the full pre-push verification
   including schema drift detection.

If the surface map is stale, the workflow is:

```bash
bun run verify:stack          # Fails: surface map changed
git add .outfitter/surface.json
git commit -m "chore: regenerate surface map"
bun run verify:stack          # Should pass now
gt submit                     # Safe to submit
```

### When to Run

Run `verify:stack` at these points in a stacked workflow:

- **After modifying any action definition** (`apps/outfitter/src/actions/*.ts`)
- **After changing handler input/output types** that affect Zod schemas
- **Before `gt submit` or `gt stack submit`** on the stack root or any branch
  that touches action code
- **After rebasing a stack** onto a new main that may have changed schemas

### Quick Alias

Add to your shell config for convenience:

```bash
alias vs="bun run verify:stack"
```

## Fast Triage: CI Red Across the Whole Stack

When multiple PRs in a stack fail CI with the same error, follow this playbook:

### Step 1 — Identify the Shared Failure

Check if all failing PRs report the same error. Common patterns:

| Error pattern                                | Likely cause                                   |
| -------------------------------------------- | ---------------------------------------------- |
| `Schema drift detected: ~ <action> (input)`  | Stale `.outfitter/surface.json`                |
| `Schema drift detected: ~ <action> (output)` | Stale surface map (output shape)               |
| `Schema drift detected: + <action>`          | New action not in surface map                  |
| `Schema drift detected: - <action>`          | Removed action still in surface map            |
| `Exports normalized` failure                 | Missing re-export after adding/moving a module |
| `Docs readme sentinel` failure               | Stale `docs/README.md` generated sections      |

### Step 2 — Fix at the Source

For schema drift, the fix is always the same:

```bash
# On the branch that introduced the schema change
# No build step needed — Bun transpiles TypeScript on the fly
bun run apps/outfitter/src/cli.ts schema generate
git add .outfitter/surface.json
git commit -m "chore: regenerate surface map"
```

### Step 3 — Propagate Through the Stack

After fixing the source branch, restack to propagate the fix:

```bash
gt restack       # Rebase all downstream branches onto the fix
gt stack submit  # Re-submit the entire stack
```

### Step 4 — Verify Before Re-Submit

Before re-submitting, confirm the fix propagated:

```bash
gt checkout <last-branch-in-stack>
bun run verify:stack
```

If this passes on the last branch in the stack, all intermediate branches will
also pass.

### Anti-Patterns to Avoid

- **Do not fix the surface map in every branch separately.** Fix it once at the
  source and restack.
- **Do not merge PRs that pass CI while others in the stack are failing.** The
  stack shares state; merging partial fixes creates hard-to-resolve conflicts.
- **Do not skip `verify:stack` because "only types changed."** Type changes are
  the most common source of invisible schema drift.

## Changeset Coverage in Stacked PRs (OS-492)

Stacked branches can also fail CI on `tooling check-changeset` after a lower PR
merges. The failure mode looks different from schema drift, but the cause is
similar: the child PR's responsibility changed underneath it.

The changeset guard now evaluates the **current PR diff**, not a hardcoded
`origin/main...HEAD` range:

- In GitHub `pull_request` CI, it reads the live `base.sha` and `head.sha` from
  `GITHUB_EVENT_PATH` and diffs that exact commit range.
- When Graphite merges the bottom of a stack and retargets descendants, the
  next CI run sees the new base SHA automatically. The child PR is then judged
  only on the delta it still owns.
- Local and non-PR runs still fall back to `origin/main...HEAD`.

Only release-relevant package files count toward changeset coverage:

- runtime files under `packages/*/src/**`
- not `src/__tests__/`
- not `src/__snapshots__/`
- not `*.test.*`
- not `*.spec.*`

This matters for stacked follow-up PRs that only add tests or regression
coverage in a package after the releasable change already landed lower in the
stack.

### Fast Triage: Changeset Failure After a Lower PR Merges

If a child PR turns red on `Packages missing changeset coverage`, check the
actual PR diff first:

```bash
gh pr diff <pr-number> --name-only
```

Interpret the result in this order:

1. If the diff is only tests, snapshots, or specs under `packages/*/src/**`,
   the validator should ignore it. Treat any failure as a regression in
   `tooling check-changeset`.
2. If the diff still contains runtime package files, the PR still owns a
   releasable delta and needs changeset coverage for the touched package.
3. If the PR is intentionally non-releasable, confirm it qualifies for
   `release:none` rather than forcing a placeholder changeset into the stack.

Use this before adding emergency follow-up changesets. The right fix is usually
to narrow the validator or adjust the current PR diff, not to paper over the
stack with duplicate release notes.

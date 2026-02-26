# Block Drift Detection

Registry block drift occurs when local config files (`.lefthook.yml`, `.oxlintrc.json`, `scripts/bootstrap.sh`, etc.) diverge from the canonical versions in `@outfitter/tooling`'s registry.

## How It Works

`outfitter check` (without mode flags) compares each installed block's local files against the registry. It uses the `.outfitter/manifest.json` manifest when available, falling back to file-presence heuristic detection.

## Where Block Drift Is Checked

| Surface       | Command                              | Includes block drift? |
| ------------- | ------------------------------------ | --------------------- |
| Manual        | `outfitter check`                    | Yes                   |
| Pre-push hook | `outfitter check --pre-push`         | Yes (first step)      |
| CI            | `outfitter check --ci` (`verify:ci`) | Yes (first step)      |
| Full suite    | `outfitter check --all`              | Yes (first step)      |

Block drift runs as the first orchestrator step so it fails fast before heavier checks like typecheck or tests.

Orchestrator modes use `--manifest-only` so they only check blocks formally tracked in `.outfitter/manifest.json`. The file-presence heuristic (which detects blocks without a manifest) still runs for manual `outfitter check` invocations.

## Diagnosing Drift Failures

1. **Identify drifted blocks**: Run `outfitter check --verbose` to see which files differ and why (modified vs missing).

2. **Compare against registry**: The registry lives at `packages/tooling/registry/registry.json`. Each block entry contains the canonical file contents.

3. **Common causes**:
   - A tooling upgrade bumped the registry but local files were not re-synced.
   - A manual edit to a managed config file (e.g. `.lefthook.yml`).
   - A new block was added to the registry without running `outfitter add`.

4. **Fix drift**: Run `outfitter add <block> --force` to restore registry defaults for a specific block. For example:

   ```bash
   outfitter add lefthook --force
   outfitter add bootstrap --force
   ```

5. **Verify**: Run `outfitter check` again to confirm all blocks are current.

## Related

- [OS-441](https://linear.app/outfitter/issue/OS-441) — Schema drift detection reliability
- [OS-442](https://linear.app/outfitter/issue/OS-442) — Registry block drift guardrails (this work)
- `.outfitter/surface.json` — Schema surface map (separate drift mechanism, see [outfitter-directory.md](./outfitter-directory.md))

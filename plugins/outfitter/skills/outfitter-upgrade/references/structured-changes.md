# Structured Changes Reference

Type definitions and parsing examples for `outfitter upgrade --json` output.

## Type Definitions

### PackageVersionInfo

```typescript
interface PackageVersionInfo {
  /** Full package name, e.g. "@outfitter/cli" */
  name: string;
  /** Currently installed version */
  current: string;
  /** Latest available version from npm (null if query failed) */
  latest: string | null;
  /** Whether an update is available */
  updateAvailable: boolean;
  /** Whether the update contains breaking changes */
  breaking: boolean;
}
```

### MigrationGuide

```typescript
interface MigrationGuide {
  /** The @outfitter/* package name */
  packageName: string;
  /** Currently installed version */
  fromVersion: string;
  /** Latest available version */
  toVersion: string;
  /** Whether this is a breaking change */
  breaking: boolean;
  /** Migration step strings (markdown) */
  steps: string[];
  /** Structured changes from migration frontmatter */
  changes?: MigrationChange[];
}
```

### MigrationChange

```typescript
type MigrationChangeType =
  | "renamed"
  | "removed"
  | "signature-changed"
  | "moved"
  | "deprecated"
  | "added";

interface MigrationChange {
  /** Classification of the change */
  type: MigrationChangeType;
  /** Original name/path (for renamed, removed, moved, signature-changed) */
  from?: string;
  /** New name/path (for renamed, moved, added) */
  to?: string;
  /** File or module path context */
  path?: string;
  /** Export name affected */
  export?: string;
  /** Human-readable description of the change */
  detail?: string;
  /** Path to codemod script (relative to codemods directory) */
  codemod?: string;
}
```

### CodemodSummary

```typescript
interface CodemodSummary {
  /** Number of codemods executed */
  codemodCount: number;
  /** Files changed across all codemods */
  changedFiles: string[];
  /** Errors encountered during execution */
  errors: string[];
}
```

### UpdateResult

```typescript
interface UpdateResult {
  /** Version info for each @outfitter/* package */
  packages: PackageVersionInfo[];
  /** Total packages checked */
  total: number;
  /** Number with updates available */
  updatesAvailable: number;
  /** Whether any update is breaking */
  hasBreaking: boolean;
  /** Whether mutations were applied */
  applied: boolean;
  /** Package names that were updated */
  appliedPackages: string[];
  /** Packages skipped due to breaking changes */
  skippedBreaking: string[];
  /** Migration guides (with --guide flag) */
  guides?: MigrationGuide[];
  /** Codemod results (after --apply) */
  codemods?: CodemodSummary;
}
```

## Example Output

### Version Check

```bash
outfitter upgrade --json
```

```json
{
  "packages": [
    {
      "name": "@outfitter/contracts",
      "current": "0.1.0",
      "latest": "0.2.0",
      "updateAvailable": true,
      "breaking": false
    },
    {
      "name": "@outfitter/cli",
      "current": "0.3.0",
      "latest": "0.4.0",
      "updateAvailable": true,
      "breaking": true
    }
  ],
  "total": 2,
  "updatesAvailable": 2,
  "hasBreaking": true,
  "applied": false,
  "appliedPackages": [],
  "skippedBreaking": []
}
```

### After Apply with Codemods

```bash
outfitter upgrade --all --yes --json
```

```json
{
  "packages": [...],
  "total": 2,
  "updatesAvailable": 2,
  "hasBreaking": true,
  "applied": true,
  "appliedPackages": ["@outfitter/contracts", "@outfitter/cli"],
  "skippedBreaking": [],
  "codemods": {
    "codemodCount": 1,
    "changedFiles": ["src/index.ts", "src/render.ts"],
    "errors": []
  }
}
```

### Guide with Structured Changes

```bash
outfitter upgrade --guide --json
```

```json
{
  "guides": [
    {
      "packageName": "@outfitter/cli",
      "fromVersion": "0.3.0",
      "toVersion": "0.4.0",
      "breaking": true,
      "steps": ["Move TUI imports to @outfitter/tui..."],
      "changes": [
        {
          "type": "moved",
          "from": "@outfitter/cli/render",
          "to": "@outfitter/tui/render",
          "codemod": "cli/0.4.0-move-tui-imports.ts"
        },
        {
          "type": "moved",
          "from": "@outfitter/cli/streaming",
          "to": "@outfitter/tui/streaming",
          "codemod": "cli/0.4.0-move-tui-imports.ts"
        },
        {
          "type": "renamed",
          "from": "formatOutput",
          "to": "renderOutput",
          "detail": "The formatOutput function was renamed to renderOutput for consistency"
        }
      ]
    }
  ]
}
```

## Parsing Pattern

```typescript
// Parse and categorize changes
function categorizeChanges(guide: MigrationGuide) {
  const automated: MigrationChange[] = [];
  const manual: MigrationChange[] = [];

  for (const change of guide.changes ?? []) {
    if (change.codemod) {
      automated.push(change);
    } else {
      manual.push(change);
    }
  }

  return { automated, manual };
}
```

The `automated` changes are handled by the CLI's codemod runner during upgrade. Focus agent effort on the `manual` changes.

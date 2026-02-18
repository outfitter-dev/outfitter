# Codemods

Executable TypeScript codemods for `@outfitter/*` package migrations. Referenced from migration doc frontmatter via the `codemod` field and executed by `outfitter update --apply`.

## Format

Each codemod exports a `transform` function:

```typescript
interface CodemodOptions {
  readonly targetDir: string;
  readonly dryRun: boolean;
}

interface CodemodResult {
  readonly changedFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly errors: readonly string[];
}

export async function transform(options: CodemodOptions): Promise<CodemodResult> {
  // ...
}
```

## Directory Structure

```
codemods/
  cli/
    0.4.0-move-tui-imports.ts    ← referenced from cli-0.4.0.md
  contracts/
    adopt-result-types.ts        ← adoption codemod
  README.md
```

Codemods are organized by package short name, with files named `<version>-<description>.ts`.

## Referencing from Migration Docs

Add a `codemod` field to a change entry in the migration doc frontmatter:

```yaml
changes:
  - type: moved
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
    codemod: "cli/0.4.0-move-tui-imports.ts"
```

The path is relative to this `codemods/` directory.

## Design Principles

- **Idempotent** — Running a codemod twice produces the same result.
- **Text-based first** — Prefer string/regex transforms for simple renames and import moves. Use TypeScript compiler API only for complex AST transforms.
- **Bun-first** — Use `Bun.Glob`, `Bun.Transpiler` where applicable.
- **Report everything** — Return all changed, skipped, and errored files in the result.

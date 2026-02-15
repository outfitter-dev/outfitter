# @outfitter/docs

CLI and host command adapter for Outfitter docs workflows.

## Commands

- `docs sync` — assemble package docs output
- `docs check` — verify package docs output freshness
- `docs export --target <packages|llms|llms-full|all>` — export docs artifacts
- `--mdx-mode <strict|lossy>` — control MDX handling for sync/check/export

## Host CLI Adapter

```ts
import { createDocsCommand } from "@outfitter/docs";

program.addCommand(createDocsCommand());
```

## Standalone CLI

```bash
bunx @outfitter/docs docs sync
bunx @outfitter/docs docs check
bunx @outfitter/docs docs export --target llms
```

## Monorepo Canonical Routing

Inside this monorepo, maintenance workflows are routed through `outfitter repo`:

```bash
bun run apps/outfitter/src/cli.ts repo sync docs --cwd .
bun run apps/outfitter/src/cli.ts repo check docs --cwd .
bun run apps/outfitter/src/cli.ts repo export docs --target llms --cwd .
```

Compatibility note: `outfitter docs <sync|check|export>` still works today, but
new scripts should prefer `outfitter repo ...`.

## License

MIT

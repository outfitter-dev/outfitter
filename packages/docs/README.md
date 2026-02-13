# @outfitter/docs

CLI and host command adapter for Outfitter docs workflows.

## Commands

- `docs sync` — assemble package docs output
- `docs check` — verify package docs output freshness

## Host CLI Adapter

```ts
import { createDocsCommand } from "@outfitter/docs";

program.addCommand(createDocsCommand());
```

## Standalone CLI

```bash
bunx @outfitter/docs docs sync
bunx @outfitter/docs docs check
```

## License

MIT

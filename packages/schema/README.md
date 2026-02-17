# @outfitter/schema

Schema introspection, surface map generation, and drift detection for Outfitter action registries.

**Stability: Active** -- APIs evolving based on usage.

## Installation

```bash
bun add @outfitter/schema zod
```

`zod` is a peer dependency because schema generation converts Zod input/output contracts into JSON Schema.

## Quick Start

```typescript
import { createActionRegistry, defineAction, Result } from "@outfitter/contracts";
import { generateSurfaceMap } from "@outfitter/schema/surface";
import { z } from "zod";

const registry = createActionRegistry().add(
  defineAction({
    id: "doctor",
    description: "Validate environment",
    surfaces: ["cli", "mcp"],
    input: z.object({ verbose: z.boolean().optional() }),
    handler: async () => Result.ok({ ok: true }),
  })
);

const surface = generateSurfaceMap(registry, {
  version: "1.0.0",
  generator: "runtime",
});

console.log(surface.actions.map((a) => a.id));
```

## Subpath Exports

| Subpath | What's In It |
|---------|---------------|
| `@outfitter/schema` | Full public API from all modules |
| `@outfitter/schema/manifest` | `generateManifest`, `ActionManifest*` types |
| `@outfitter/schema/surface` | `generateSurfaceMap`, snapshot path + read/write helpers |
| `@outfitter/schema/diff` | `diffSurfaceMaps`, diff result types |
| `@outfitter/schema/markdown` | `formatManifestMarkdown`, markdown formatting options |

## Core Workflows

### 1) Generate a manifest from an action registry

```typescript
import { generateManifest } from "@outfitter/schema/manifest";

const manifest = generateManifest(registry, {
  version: "1.0.0",
  surface: "mcp", // optional: cli | mcp | api
});

console.log(manifest.errors.validation.exit); // 1
console.log(manifest.outputModes); // ["human", "json", "jsonl", "tree", "table"]
```

### 2) Generate and persist a surface map snapshot

```typescript
import {
  generateSurfaceMap,
  resolveSnapshotPath,
  writeSurfaceMap,
} from "@outfitter/schema/surface";

const surface = generateSurfaceMap(registry, {
  version: "1.0.0",
  generator: "build",
});

const path = resolveSnapshotPath(process.cwd(), ".outfitter", "v1.0.0");
await writeSurfaceMap(surface, path);
```

### 3) Detect schema drift in CI

```typescript
import { generateSurfaceMap, readSurfaceMap } from "@outfitter/schema/surface";
import { diffSurfaceMaps } from "@outfitter/schema/diff";

const committed = await readSurfaceMap(".outfitter/snapshots/v1.0.0.json");
const current = generateSurfaceMap(registry, { version: "1.0.0" });

const diff = diffSurfaceMaps(committed, current);
if (diff.hasChanges) {
  console.error("Surface drift detected", diff);
  process.exit(1);
}
```

### 4) Generate markdown reference docs

```typescript
import { formatManifestMarkdown } from "@outfitter/schema/markdown";

const manifest = generateManifest(registry, { surface: "mcp", version: "1.0.0" });

const markdown = formatManifestMarkdown(manifest, {
  surface: "mcp",
  title: "MCP Tool Reference",
  toc: true,
  timestamp: false,
});

await Bun.write("docs/reference/tools.md", markdown);
```

## API Notes

- `generateManifest()` accepts either an `ActionRegistry` or a plain array of action specs.
- `generateSurfaceMap()` wraps manifest output with envelope metadata (`$schema`, `generator`).
- `diffSurfaceMaps()` ignores volatile timestamps and reports granular change categories (`input`, `output`, `surfaces`, `cli`, `mcp`, `api`, metadata changes).
- `formatManifestMarkdown()` renders either MCP-tool docs or CLI-command docs from the same manifest source.

## License

MIT

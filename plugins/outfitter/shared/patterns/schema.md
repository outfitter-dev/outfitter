# Schema Patterns

Use `@outfitter/schema` and `@outfitter/contracts` to generate introspection artifacts for CLI/MCP parity, docs, and CI drift detection.

## Core Building Blocks

```typescript
import {
  zodToJsonSchema,
  type ActionCapability,
  type CapabilitySurface,
} from "@outfitter/contracts";
import {
  generateManifest,
  formatManifestMarkdown,
  generateSurfaceMap,
  writeSurfaceMap,
  readSurfaceMap,
  diffSurfaceMaps,
} from "@outfitter/schema";
```

- `zodToJsonSchema()` lives in `@outfitter/contracts` (moved from `@outfitter/mcp`).
- `generateManifest()` produces machine-readable action metadata from a registry.
- `formatManifestMarkdown()` emits docs-friendly markdown.
- `generateSurfaceMap()` produces surface map artifacts; `hashSurfaceMap()` computes the content hash written to `surface.lock`.
- `diffSurfaceMaps()` reports added/removed/modified actions for drift checks.

## Zod to JSON Schema

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "@outfitter/contracts";

const Input = z.object({
  id: z.string().uuid(),
  verbose: z.boolean().default(false),
});

const jsonSchema = zodToJsonSchema(Input);
```

Use this when exporting transport-neutral schemas for manifests, MCP tool contracts, or generated docs.

## Surface Map Generation

```typescript
import {
  generateSurfaceMap,
  hashSurfaceMap,
  writeSurfaceMap,
  writeSurfaceLock,
} from "@outfitter/schema";

const surfaceMap = generateSurfaceMap(registry, { generator: "build" });
await writeSurfaceMap(surfaceMap, ".outfitter/_surface.json");
await writeSurfaceLock(hashSurfaceMap(surfaceMap), ".outfitter/surface.lock");
```

Surface maps extend action manifests with envelope metadata (`$schema`, generator). The committed artifact is `.outfitter/surface.lock` (a SHA-256 hash); the full JSON is `.outfitter/_surface.json` (gitignored, used for semantic diffs).

## Drift Detection

```typescript
import {
  generateSurfaceMap,
  hashSurfaceMap,
  readSurfaceLock,
  readSurfaceMap,
  diffSurfaceMaps,
} from "@outfitter/schema";

const committedHash = await readSurfaceLock(".outfitter/surface.lock");
const runtime = generateSurfaceMap(registry, { generator: "runtime" });
const runtimeHash = hashSurfaceMap(runtime);

if (committedHash !== runtimeHash) {
  // Hashes differ — compute semantic diff
  const committed = await readSurfaceMap(".outfitter/_surface.json");
  const diff = diffSurfaceMaps(committed, runtime);
  console.error("Schema drift detected", diff);
  process.exitCode = 1;
}
```

`hashSurfaceMap()` strips volatile timestamps and sorts keys for deterministic hashing. `diffSurfaceMaps()` provides the semantic delta when hashes differ.

## Action Capability Types

Use contracts capability types when modeling schema-aware tooling:

```typescript
import type { ActionCapability, CapabilitySurface } from "@outfitter/contracts";

const surfaces: CapabilitySurface[] = ["cli", "mcp"];
const capability: ActionCapability = {
  id: "users.list",
  surfaces,
  input: zodToJsonSchema(Input),
};
```

## CLI Integration via `buildCliCommands()`

`@outfitter/cli/actions` auto-registers a `schema` command when `schema` options are passed:

```typescript
import { buildCliCommands } from "@outfitter/cli/actions";

const commands = buildCliCommands(registry, {
  schema: {
    programName: "mycli",
    surface: { cwd: process.cwd(), outputDir: ".outfitter" },
  },
});
```

This enables:

- `mycli schema show [action]`
- `mycli schema generate [--dry-run] [--snapshot <name>]`
- `mycli schema diff [--against <name> | --from <a> --to <b>]`

Use this for discoverability and parity audits across CLI/MCP/API surfaces.

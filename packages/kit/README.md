# @outfitter/kit

Version coordination meta-package for Outfitter Kit.

## Purpose

This package ensures compatible versions across all `@outfitter/*` packages. Install it alongside specific packages to get coordinated version constraints via `peerDependencies`.

## Installation

```bash
bun add @outfitter/kit
```

## When to Use

Use `@outfitter/kit` when:

1. **Building applications** that use multiple Outfitter packages
2. **Ensuring compatibility** between package versions
3. **Checking version requirements** programmatically

```bash
# Install kit alongside the packages you need
bun add @outfitter/kit @outfitter/cli @outfitter/logging @outfitter/config
```

The kit's `peerDependencies` will warn if you have incompatible versions installed.

## Version Matrix

See [VERSIONS.md](./VERSIONS.md) for the complete compatibility matrix.

### Current Release (0.1.0)

| Package | Minimum Version |
|---------|-----------------|
| @outfitter/contracts | 0.1.0 |
| @outfitter/types | 0.1.0 |
| @outfitter/cli | 0.1.0 |
| @outfitter/config | 0.1.0 |
| @outfitter/logging | 0.1.0 |
| @outfitter/file-ops | 0.1.0 |
| @outfitter/state | 0.1.0 |
| @outfitter/ui | 0.1.0 |
| @outfitter/mcp | 0.1.0 |
| @outfitter/index | 0.1.0 |
| @outfitter/daemon | 0.1.0 |
| @outfitter/testing | 0.1.0 |

## Exports

### KIT_VERSION

The current kit version (matches package.json).

```typescript
import { KIT_VERSION } from "@outfitter/kit";

console.log(`Using Outfitter Kit ${KIT_VERSION}`);
```

### MINIMUM_VERSIONS

Minimum compatible versions for each package.

```typescript
import { MINIMUM_VERSIONS } from "@outfitter/kit";

// Check if a package meets the minimum version
const cliMinimum = MINIMUM_VERSIONS["@outfitter/cli"]; // "0.1.0"
```

### OutfitterPackage

Type for valid package names in the kit.

```typescript
import { type OutfitterPackage, MINIMUM_VERSIONS } from "@outfitter/kit";

function getMinVersion(pkg: OutfitterPackage): string {
  return MINIMUM_VERSIONS[pkg];
}

getMinVersion("@outfitter/cli"); // "0.1.0"
getMinVersion("@outfitter/invalid"); // TypeScript error
```

## API Reference

| Export | Type | Description |
|--------|------|-------------|
| `KIT_VERSION` | `string` | Current kit version |
| `MINIMUM_VERSIONS` | `Record<OutfitterPackage, string>` | Minimum versions for all packages |
| `OutfitterPackage` | `type` | Union type of valid package names |

## Dependency Tiers

Packages are organized into tiers based on stability:

### Foundation (cold)
Stable APIs, rarely change:
- `@outfitter/contracts` - Result/Error patterns
- `@outfitter/types` - Branded types

### Runtime (warm)
Expected to evolve:
- `@outfitter/cli` - CLI framework
- `@outfitter/config` - Configuration
- `@outfitter/logging` - Structured logging
- `@outfitter/file-ops` - File operations
- `@outfitter/state` - State management
- `@outfitter/ui` - Terminal UI
- `@outfitter/mcp` - MCP server framework
- `@outfitter/index` - SQLite FTS5 indexing
- `@outfitter/daemon` - Daemon lifecycle

### Tooling (lukewarm)
Workflow-focused:
- `@outfitter/testing` - Test harnesses

## Related Packages

All `@outfitter/*` packages are designed to work together. See individual package documentation:

- [@outfitter/contracts](../contracts/README.md) - Result types and error patterns
- [@outfitter/cli](../cli/README.md) - CLI framework
- [@outfitter/daemon](../daemon/README.md) - Daemon lifecycle management
- [@outfitter/testing](../testing/README.md) - Test harnesses

## License

MIT

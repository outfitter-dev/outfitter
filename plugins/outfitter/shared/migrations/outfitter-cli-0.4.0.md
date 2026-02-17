---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
---

# @outfitter/cli → 0.4.0

## New APIs

- `@outfitter/tui` is now the home for rendering, streaming, theme, and prompt modules previously exported by `@outfitter/cli` subpaths.
- `buildCliCommands()` supports schema-centric command flows aligned with `@outfitter/schema`.

## Migration Steps

### Move TUI imports to `@outfitter/tui`

**Before**

```typescript
import { renderTable } from "@outfitter/cli/render";
import { createSpinner } from "@outfitter/cli/streaming";
```

**After**

```typescript
import { renderTable } from "@outfitter/tui/render";
import { createSpinner } from "@outfitter/tui/streaming";
```

### Move destructive confirmation helper

**Before**

```typescript
import { confirmDestructive } from "@outfitter/cli/input";
```

**After**

```typescript
import { confirmDestructive } from "@outfitter/tui/confirm";
```

## No Action Required

- Core command and output modules under `@outfitter/cli` remain available.
- Existing `createCLI()` and `output()` usage continues to work.

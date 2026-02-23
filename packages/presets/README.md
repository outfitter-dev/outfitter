# @outfitter/presets

Scaffold presets and shared dependency versions for Outfitter projects.

## Installation

```bash
bun add -d @outfitter/presets
```

## Overview

This package provides:

- **Scaffold presets** -- Template configurations used by `outfitter add` to generate project boilerplate
- **Shared dependency versions** -- Catalog-resolved dependency versions ensuring consistency across Outfitter projects

## Usage

Presets are consumed by the `outfitter` CLI during scaffolding:

```bash
npx outfitter add <preset-name>
```

For programmatic access to preset metadata:

```typescript
import { presets } from "@outfitter/presets";
```

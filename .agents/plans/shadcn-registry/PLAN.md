# Shadcn-Style Registry for Outfitter Tooling

## Goal

Replace `@outfitter/agents` and simplify `@outfitter/tooling` by adopting a shadcn-style registry pattern. Users copy files into their projects rather than installing dependencies.

## Current State

- `@outfitter/agents` — npm package with scaffolding files
- `@outfitter/tooling` — npm package with config presets
- Files are dependencies, not owned by users
- Config customization requires overrides or ejecting

## Target State

- Single `outfitter` CLI with `add` command
- Registry of blocks (claude, biome, lefthook, bootstrap)
- Files copied directly into projects
- Users own and customize everything
- No `@outfitter/agents` or `@outfitter/tooling` npm installs needed for scaffolding

## Blocks

| Block | Files | Dependencies |
|-------|-------|--------------|
| `claude` | `.claude/settings.json`, `.claude/hooks/*` | — |
| `biome` | `biome.json` | `ultracite` (devDep) |
| `lefthook` | `.lefthook.yml` | `lefthook` (devDep) |
| `bootstrap` | `scripts/bootstrap.sh` | — |
| `scaffolding` | All of the above | All of the above |
| `all` | Reserved for future expansion | — |

## Architecture

### Source Files

Source files live in their natural locations in this repo:

```
.claude/
├── settings.json
├── hooks/
│   └── format-code-on-stop.sh
└── rules/
    └── ultracite.md

scripts/
└── bootstrap.sh

packages/tooling/
├── biome.json
└── lefthook.yml
```

### Registry Build

A build script collects source files and generates `registry.json`:

```
packages/tooling/
├── src/
│   └── registry/
│       ├── build.ts      # generates registry.json
│       ├── schema.ts     # TypeScript types for registry
│       └── index.ts      # exports for programmatic use
├── registry/
│   ├── registry.json     # generated, embeds file contents
│   └── blocks/           # optional: block-specific metadata
│       ├── claude.json
│       ├── biome.json
│       ├── lefthook.json
│       └── bootstrap.json
└── package.json
```

### Registry Schema

```typescript
interface Registry {
  version: string;
  blocks: Record<string, Block>;
}

interface Block {
  name: string;
  description: string;
  files: FileEntry[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  extends?: string[];  // for composite blocks like "scaffolding"
}

interface FileEntry {
  path: string;           // destination path relative to project root
  content: string;        // file contents (embedded)
  executable?: boolean;   // chmod +x after copying
  template?: boolean;     // process as template (future)
}
```

### Generated registry.json Example

```json
{
  "version": "1.0.0",
  "blocks": {
    "claude": {
      "name": "claude",
      "description": "Claude Code settings and hooks",
      "files": [
        {
          "path": ".claude/settings.json",
          "content": "{\n  \"hooks\": { ... }\n}"
        },
        {
          "path": ".claude/hooks/format-code-on-stop.sh",
          "content": "#!/usr/bin/env bash\n...",
          "executable": true
        }
      ]
    },
    "biome": {
      "name": "biome",
      "description": "Biome linter/formatter configuration via Ultracite",
      "files": [
        {
          "path": "biome.json",
          "content": "{ ... }"
        }
      ],
      "devDependencies": {
        "ultracite": "^7.0.0"
      }
    },
    "lefthook": {
      "name": "lefthook",
      "description": "Git hooks via Lefthook",
      "files": [
        {
          "path": ".lefthook.yml",
          "content": "pre-commit:\n  ..."
        }
      ],
      "devDependencies": {
        "lefthook": "^2.0.0"
      }
    },
    "bootstrap": {
      "name": "bootstrap",
      "description": "Project bootstrap script",
      "files": [
        {
          "path": "scripts/bootstrap.sh",
          "content": "#!/usr/bin/env bash\n...",
          "executable": true
        }
      ]
    },
    "scaffolding": {
      "name": "scaffolding",
      "description": "Full starter kit (claude + biome + lefthook + bootstrap)",
      "extends": ["claude", "biome", "lefthook", "bootstrap"]
    }
  }
}
```

## CLI Commands

### `outfitter add <block>`

```bash
# Add specific blocks
outfitter add claude
outfitter add biome
outfitter add lefthook
outfitter add bootstrap

# Add composite block
outfitter add scaffolding   # adds all starter files

# Flags
outfitter add claude --force    # overwrite existing files
outfitter add claude --dry-run  # show what would be added
```

### `outfitter init`

Interactive initialization that asks what to set up:

```bash
outfitter init
# ? What would you like to set up?
# ◉ Claude Code settings & hooks
# ◉ Biome (via Ultracite)
# ◉ Lefthook git hooks
# ◉ Bootstrap script
#
# Adding scaffolding...
# ✓ Created .claude/settings.json
# ✓ Created .claude/hooks/format-code-on-stop.sh
# ✓ Created biome.json
# ✓ Created .lefthook.yml
# ✓ Created scripts/bootstrap.sh
#
# Installing dependencies...
# ✓ Added ultracite, lefthook to devDependencies
```

### `outfitter diff <block>` (future)

Show differences between local files and registry:

```bash
outfitter diff claude
# .claude/settings.json: 3 lines differ
# .claude/hooks/format-code-on-stop.sh: up to date
```

## Build Process

### Build Script: `scripts/build-registry.ts`

```typescript
#!/usr/bin/env bun

import { readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const REGISTRY_PATH = join(ROOT, "packages/tooling/registry/registry.json");

const BLOCKS = {
  claude: {
    description: "Claude Code settings and hooks",
    files: [
      ".claude/settings.json",
      ".claude/hooks/format-code-on-stop.sh",
    ],
  },
  biome: {
    description: "Biome linter/formatter configuration via Ultracite",
    files: ["packages/tooling/biome.json"],
    remap: { "packages/tooling/biome.json": "biome.json" },
    devDependencies: { ultracite: "^7.0.0" },
  },
  lefthook: {
    description: "Git hooks via Lefthook",
    files: [".lefthook.yml"],
    devDependencies: { lefthook: "^2.0.0" },
  },
  bootstrap: {
    description: "Project bootstrap script",
    files: ["scripts/bootstrap.sh"],
  },
  scaffolding: {
    description: "Full starter kit",
    extends: ["claude", "biome", "lefthook", "bootstrap"],
  },
};

// Build logic...
```

### Integration with Package Build

Add to `packages/tooling/package.json`:

```json
{
  "scripts": {
    "prebuild": "bun run ../../scripts/build-registry.ts",
    "build": "bunup"
  },
  "files": [
    "dist",
    "registry"
  ]
}
```

## Migration Path

### Phase 1: Build Registry Infrastructure

1. Create registry schema and types
2. Create build script
3. Generate initial registry.json
4. Add `outfitter add` command

### Phase 2: Update CLI

1. Implement `outfitter add <block>`
2. Update `outfitter init` to use registry
3. Add `--force` and `--dry-run` flags

### Phase 3: Deprecate Old Packages

1. Mark `@outfitter/agents` as deprecated
2. Remove agents scaffolding logic from tooling
3. Update docs to use `outfitter add`

### Phase 4: Cleanup

1. Delete `packages/agents`
2. Simplify `packages/tooling` (keep only programmatic exports if needed)
3. Update all references

## File Locations After Migration

```
outfitter/
├── apps/
│   └── outfitter/           # CLI (published as `outfitter`)
│       └── src/
│           └── commands/
│               ├── add.ts   # new: outfitter add
│               └── init.ts  # updated: uses registry
├── packages/
│   └── tooling/             # simplified, maybe just presets
│       ├── registry/
│       │   └── registry.json
│       └── src/
│           └── registry/
│               ├── build.ts
│               ├── schema.ts
│               └── index.ts
├── scripts/
│   ├── build-registry.ts
│   └── bootstrap.sh         # source for bootstrap block
├── .claude/                  # source for claude block
│   ├── settings.json
│   └── hooks/
└── .lefthook.yml            # source for lefthook block
```

## Open Questions

1. **Remote registry?** — Start with bundled registry.json, could add remote fetching later
2. **Templates?** — Support variable substitution in files? (e.g., `{{PROJECT_NAME}}`)
3. **Versioning?** — How to handle registry version vs block versions?
4. **Diffing/updates?** — How to update files after initial add? (shadcn uses `diff`)

## Success Criteria

- [x] `npx outfitter add scaffolding` works in any project
- [x] Files are copied, not linked or required as dependencies
- [x] Dependencies are added to package.json automatically
- [ ] `outfitter init` provides interactive setup (future enhancement)
- [x] Registry builds automatically during package build
- [ ] `@outfitter/agents` can be deprecated (pending init update)

## Implementation Status (2026-02-05)

### Completed

1. **Registry Schema** (`packages/tooling/src/registry/schema.ts`)
   - Zod schemas for FileEntry, Block, Registry
   - TypeScript types exported for programmatic use

2. **Registry Build Script** (`packages/tooling/src/registry/build.ts`)
   - Collects source files from repo locations
   - Embeds content into registry.json
   - Detects and preserves executable permissions
   - Runs automatically during `bun run build`

3. **`outfitter add` Command** (`apps/outfitter/src/commands/add.ts`)
   - `outfitter add <block>` - adds files to project
   - `outfitter add list` - lists available blocks
   - `--force` flag to overwrite existing files
   - `--dry-run` flag to preview changes
   - Handles composite blocks (scaffolding extends claude+biome+lefthook+bootstrap)
   - Updates package.json dependencies automatically

4. **Build Integration**
   - `packages/tooling/package.json` runs `build:registry` before build
   - Registry included in package files for npm publish

### Deferred

1. **Interactive `outfitter init`** - The existing `init` command handles project scaffolding from templates. Adding interactive block selection is a future enhancement.

2. **`@outfitter/agents` deprecation** - Can proceed once interactive init is implemented, or can be done manually by updating docs to recommend `outfitter add` instead.

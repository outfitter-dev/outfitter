# Turbo Remote Cache

Self-hosted Turbo remote cache on Cloudflare Workers + R2, providing shared build caching across CI and local development.

**Endpoint**: `https://turbo-cache.outfitter.dev`

## How It Works

Turbo hashes each task's inputs (source files, dependencies, config) and checks the remote cache before running. On a cache hit, it downloads the artifact instead of rebuilding. Signature verification ensures artifact integrity.

```
turbo run build
├── Hash task inputs
├── Check remote cache (turbo-cache.outfitter.dev)
│   ├── Cache hit  → download artifact (skip build)
│   └── Cache miss → run build → upload artifact
└── Done
```

## Setup for a New Repo

### 1. Install Turbo

```bash
bun add -d turbo
```

### 2. Configure `turbo.json`

Add `remoteCache.signature` to enable artifact signing:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "remoteCache": {
    "signature": true
  },
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

### 3. Local Auth (`.turbo/config.json`)

Create `.turbo/config.json` (gitignored by default):

```json
{
  "apiUrl": "https://turbo-cache.outfitter.dev",
  "teamId": "outfitter",
  "token": "<TURBO_TOKEN>",
  "signature": true
}
```

Get the `TURBO_TOKEN` value from 1Password or another team member.

### 4. Signature Key (`.envrc`)

Create `.envrc` for direnv (gitignored):

```bash
export TURBO_REMOTE_CACHE_SIGNATURE_KEY=<key>
```

Get the key value from 1Password or another team member.

Then allow direnv:

```bash
direnv allow
```

### 5. Gitignore

Ensure these are gitignored:

```
.envrc
.turbo/
```

### 6. CI Configuration

Add these secrets to the repo's GitHub Actions settings:

| Secret | Purpose |
|--------|---------|
| `TURBO_TOKEN` | Auth token for the cache API |
| `TURBO_API` | `https://turbo-cache.outfitter.dev` |
| `TURBO_TEAM` | `outfitter` |
| `TURBO_REMOTE_CACHE_SIGNATURE_KEY` | Artifact signing key |

Pass them as env vars in your CI workflow:

```yaml
- name: Build
  run: bun run build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_API: ${{ secrets.TURBO_API }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
    TURBO_REMOTE_CACHE_SIGNATURE_KEY: ${{ secrets.TURBO_REMOTE_CACHE_SIGNATURE_KEY }}
```

## Infrastructure

The cache server lives at [`outfitter-dev/turborepo-remote-cache`](https://github.com/outfitter-dev/turborepo-remote-cache):

- **Runtime**: Cloudflare Workers
- **Storage**: Cloudflare R2
- **Domain**: `turbo-cache.outfitter.dev` (CNAME to Workers)
- **Worker name**: `outfitter-turbo-cache`

### Deploying Changes

```bash
cd ../turbo-cache
bun install
bun run deploy
```

## Troubleshooting

### "Remote caching disabled"

Missing auth. Check that `.turbo/config.json` exists with a valid token, or that `TURBO_TOKEN` and `TURBO_API` env vars are set.

### "Signature verification failed"

The `TURBO_REMOTE_CACHE_SIGNATURE_KEY` doesn't match between the machine that uploaded the artifact and the one downloading it. Ensure all environments use the same key.

### Cache not being used

- Run `turbo run build --verbosity=2` to see cache decisions
- Check that `turbo.json` has correct `outputs` for each task
- Ensure `.turbo/` is not committed (it's local config)

---
name: bun-first
description: "Bun-first development: prefer native APIs over npm packages, audit for migration opportunities, eliminate unnecessary dependencies. Use when evaluating packages, starting projects, or migrating from Node.js."
metadata:
  version: "2.0.1"
  author: outfitter
  category: development
---

# Bun First

Bun-first philosophy: prefer native APIs over external packages.

<when_to_use>

- Auditing existing projects for Bun migration opportunities
- Starting new TypeScript projects
- Evaluating whether to add a dependency
- Reviewing code that uses Node.js APIs
- Cleaning up package.json bloat

**Boundary**: This skill covers *when* to use Bun and *what* it replaces. For detailed Bun API patterns and implementation examples, load the `bun-fieldguide` skill instead.

</when_to_use>

## CLI Commands

Use Bun directly instead of Node.js tooling:

| Instead of | Use |
| ---------- | --- |
| `node file.ts` or `ts-node file.ts` | `bun file.ts` |
| `jest` or `vitest` | `bun test` |
| `webpack` or `esbuild` (CLI) | `bun build` |
| `npm install` / `yarn` / `pnpm` | `bun install` |
| `npm run script` | `bun run script` |
| `npx package` | `bunx package` |
| `nodemon` | `bun --watch` |
| `node --env-file=.env` | `bun` (auto-loads .env) |

## Decision Framework

Before adding a dependency, follow this hierarchy:

```
Need functionality
│
├─► Does Bun have a built-in API?
│   └─► YES → Use it directly
│
├─► Can you wrap a Bun primitive?
│   └─► YES → Thin abstraction over Bun API
│
└─► External package (last resort)
    └─► Document why Bun couldn't do it
```

### Evaluation Checklist

1. Check Bun docs first: https://bun.sh/docs
2. Search for `Bun.` or `bun:` in docs
3. Test if Node.js API you're using has faster Bun equivalent
4. If adding package, verify Bun doesn't cover it natively

### When Packages Are Justified

- Framework-level abstractions (Hono, TanStack Router)
- Domain-specific logic (Zod schemas, date-fns)
- Protocol implementations Bun doesn't cover
- Battle-tested crypto beyond basic hashing

Document exceptions with a code comment:

```typescript
// Using date-fns: Bun has no date manipulation APIs
import { format, addDays } from 'date-fns';
```

## Quick Reference

Bun APIs organized by category. Check these before reaching for npm.

### Testing

| Bun API | Replaces |
| ------- | -------- |
| `bun:test` | jest, vitest, mocha |
| `expect()` | chai, expect.js |

```typescript
import { describe, test, expect } from 'bun:test';
```

### Database & Storage

| Bun API | Replaces |
| ------- | -------- |
| `bun:sqlite` | better-sqlite3, sql.js |
| `Bun.sql` | pg, postgres.js, mysql2 |
| `Bun.redis` | ioredis, redis |
| `Bun.s3` | @aws-sdk/client-s3 |

```typescript
import { Database } from 'bun:sqlite';
const client = Bun.redis();
const bucket = Bun.s3('my-bucket');
```

### Networking

| Bun API | Replaces |
| ------- | -------- |
| `Bun.listen()` | net.createServer |
| `Bun.connect()` | net.connect |
| `Bun.udpSocket()` | dgram.createSocket |
| `Bun.dns` | dns.lookup |

### HTTP

| Bun API | Replaces |
| ------- | -------- |
| `Bun.serve()` | express, fastify, http |
| `Bun.fetch()` | node-fetch, axios, got |

```typescript
Bun.serve({ port: 3000, fetch: (req) => new Response('ok') });
```

### Shell & Process

| Bun API | Replaces |
| ------- | -------- |
| `Bun.$` | execa, shelljs, zx |
| `Bun.spawn()` | child_process.spawn |
| `Bun.spawnSync()` | child_process.spawnSync |

```typescript
import { $ } from 'bun';
await $`ls -la`;
```

### File System

| Bun API | Replaces |
| ------- | -------- |
| `Bun.file()` | fs.readFile, fs-extra |
| `Bun.write()` | fs.writeFile |
| `file.exists()` | fs.existsSync |
| `file.stream()` | fs.createReadStream |

```typescript
const content = await Bun.file('./data.json').json();
await Bun.write('./out.txt', content);
```

### Utilities

| Bun API | Replaces |
| ------- | -------- |
| `Bun.password.hash()` | bcrypt, argon2 |
| `Bun.hash()` | xxhash, murmur, crc32 |
| `Bun.CryptoHasher` | crypto.createHash |
| `Bun.Glob` | glob, fast-glob, minimatch |
| `Bun.semver` | semver |
| `Bun.YAML.parse()` | js-yaml, yaml |
| `Bun.TOML.parse()` | toml |
| `Bun.gzipSync()` | zlib, pako |
| `Bun.zstdCompressSync()` | zstd-codec |
| `Bun.Archive` | tar, archiver |
| `Bun.sleep()` | delay, timers-promises |
| `Bun.deepEquals()` | lodash.isEqual, deep-equal |
| `Bun.escapeHTML()` | escape-html |
| `Bun.stringWidth()` | string-width |
| `Bun.Cookie` | cookie, tough-cookie |
| `Bun.randomUUIDv7()` | uuid |
| `Bun.which()` | which |

```typescript
const hash = await Bun.password.hash(password, { algorithm: 'argon2id' });
const glob = new Bun.Glob('**/*.ts');
const valid = Bun.semver.satisfies('1.2.3', '>=1.0.0');
```

### Bundling

| Bun API | Replaces |
| ------- | -------- |
| `Bun.build()` | esbuild, rollup, webpack |
| `bun build --compile` | pkg, nexe |

```bash
bun build ./index.ts --outfile dist/bundle.js --minify
```

## Frontend Development

Bun.serve() supports HTML imports with automatic bundling. No Vite/Webpack needed.

```typescript
// server.ts
import index from "./index.html";

Bun.serve({
  routes: {
    "/": index,
    "/api/data": (req) => Response.json({ ok: true }),
  },
  development: { hmr: true, console: true },
});
```

HTML files can import .tsx/.jsx/.ts directly:

```html
<!-- index.html -->
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="./app.tsx"></script>
  </body>
</html>
```

Run with hot reloading:

```bash
bun --hot server.ts
```

## Audit Command

Scan a codebase for Bun migration opportunities using the bundled audit script.

```bash
# From the skill directory (or adjust path as needed)
bun ./scripts/audit-bun-usage.ts [path]

# JSON output (default) - pipe to jq, use in CI
bun ./scripts/audit-bun-usage.ts ./my-project

# Markdown output - human readable
bun ./scripts/audit-bun-usage.ts ./my-project --format=md
```

The audit identifies:
- npm packages replaceable by Bun built-ins
- Node.js imports with Bun equivalents
- Config files for tools Bun replaces
- Files already using Bun APIs (positive signal)

## Common Migrations

### From Express/Fastify

```typescript
// Before: Express
import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('ok'));
app.listen(3000);

// After: Bun.serve + Hono
import { Hono } from 'hono';
const app = new Hono().get('/', (c) => c.text('ok'));
Bun.serve({ port: 3000, fetch: app.fetch });
```

### From Jest/Vitest

```typescript
// Before: Jest
import { describe, it, expect } from '@jest/globals';

// After: bun:test (drop-in compatible)
import { describe, it, expect } from 'bun:test';
```

### From better-sqlite3

```typescript
// Before
import Database from 'better-sqlite3';

// After (same API)
import { Database } from 'bun:sqlite';
```

### From bcrypt

```typescript
// Before
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 10);

// After
const hash = await Bun.password.hash(password, { algorithm: 'argon2id' });
```

### From execa/shelljs

```typescript
// Before
import { execa } from 'execa';
const { stdout } = await execa('ls', ['-la']);

// After
import { $ } from 'bun';
const result = await $`ls -la`;
console.log(result.text());
```

<rules>

ALWAYS:
- Check Bun docs before adding any dependency
- Use Bun.file/Bun.write over fs module
- Use bun:test for testing (Jest-compatible)
- Use bun:sqlite for SQLite (better-sqlite3 compatible)
- Use Bun.password for password hashing
- Use `Bun.$` for shell commands

NEVER:
- Add packages that duplicate Bun built-ins without documenting why
- Use node-fetch when Bun.fetch exists
- Use bcrypt when Bun.password exists
- Use fs when Bun.file/Bun.write exists
- Use child_process when Bun.$/Bun.spawn exists

DOCUMENT:
- Why a package is needed when Bun alternative exists
- Bun limitations encountered (helps track what to migrate later)
- Exceptions in code comments for future audits

</rules>

<references>

- [Bun Documentation](https://bun.sh/docs)
- [Bun API Reference](https://bun.sh/docs/api)
- [bun:sqlite](https://bun.sh/docs/api/sqlite)
- [bun:test](https://bun.sh/docs/test)

**Related skills**:
- `bun-fieldguide` — Detailed Bun API patterns, implementation examples, testing strategies
- `typescript-fieldguide` — TypeScript patterns for Bun projects, strict typing, Zod validation

</references>

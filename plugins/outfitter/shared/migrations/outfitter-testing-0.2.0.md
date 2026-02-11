---
package: "@outfitter/testing"
version: 0.2.0
breaking: false
---

# @outfitter/testing → 0.2.0

## New APIs

### Type Re-exports

All harness and factory types are now re-exported from the package root for convenient access:

```typescript
import {
  // Fixtures
  createFixture,
  loadFixture,
  withEnv,
  withTempDir,

  // CLI Harness
  createCliHarness,
  captureCLI,
  mockStdin,
  type CliHarness,
  type CliResult,
  type CliTestResult,

  // MCP Harness
  createMcpHarness,
  createMcpTestHarness,
  type McpHarness,
  type McpTestHarnessOptions,
  type McpToolResponse,

  // Mock Factories
  createTestConfig,
  createTestContext,
  createTestLogger,
  type LogEntry,
  type TestLogger,
} from "@outfitter/testing";
```

## Migration Steps

### Remove top-level `node:*` imports

Like `@outfitter/logging`, the testing package no longer uses top-level `node:*` imports. This is transparent to consumers.

### Import types from the root

**Before** (importing from submodules):
```typescript
import { createCliHarness } from "@outfitter/testing/cli-harness";
import { createMcpHarness } from "@outfitter/testing/mcp-harness";
import type { CliHarness } from "@outfitter/testing/cli-harness";
```

**After** (import from root):
```typescript
import {
  createCliHarness,
  createMcpHarness,
  type CliHarness,
} from "@outfitter/testing";
```

Both paths work, but the root import is preferred.

## No Action Required

- Existing test harness usage works unchanged
- Fixture utilities unchanged
- Mock factory APIs unchanged
- Submodule imports still work (root is additive)

# @outfitter/contracts

Result/Error patterns, error taxonomy, handler contracts, and shared interfaces for the Outfitter kit ecosystem.

## Status

**Scaffold** - Types and interfaces defined, implementations pending.

## Installation

```bash
bun add @outfitter/contracts
```

## Overview

This package provides the foundational contracts that all Outfitter packages depend on:

- **Error taxonomy** - 10 concrete error classes with category-based exit/status codes
- **Handler contract** - Transport-agnostic domain logic interface
- **Validation** - Zod-based input validation returning Results
- **Serialization** - Safe JSON handling with redaction
- **Adapters** - Pluggable interfaces for indexing, caching, auth, and storage

## Usage

```typescript
import {
  Result,
  NotFoundError,
  Handler,
  HandlerContext,
  createContext,
} from "@outfitter/contracts";

// Define a handler
const getNote: Handler<{ id: string }, Note, NotFoundError> = async (input, ctx) => {
  const note = await db.notes.find(input.id);
  if (!note) return Result.err(new NotFoundError("note", input.id));
  return Result.ok(note);
};

// Create context and invoke
const ctx = createContext({ logger, config });
const result = await getNote({ id: "abc123" }, ctx);
```

## License

MIT

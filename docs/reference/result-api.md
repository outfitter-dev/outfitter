# Result API Reference

Complete API surface for `Result<T, E>` as re-exported from `@outfitter/contracts`. The underlying implementation is [`better-result`](https://github.com/iambumeli/better-result).

## Creating Results

| Method | Signature | Description |
|--------|-----------|-------------|
| `Result.ok(value)` | `<A>(value: A) => Ok<A, never>` | Create successful result |
| `Result.ok()` | `() => Ok<void, never>` | Void success (side-effectful ops) |
| `Result.err(error)` | `<E>(error: E) => Err<never, E>` | Create error result |

```typescript
import { Result } from "@outfitter/contracts";

const success = Result.ok(42);         // Ok<number, never>
const empty = Result.ok();             // Ok<void, never>
const failure = Result.err("not found"); // Err<never, string>
```

## Type Guards

| Method | Signature | Description |
|--------|-----------|-------------|
| `result.isOk()` | `() => this is Ok<T, E>` | Narrows to Ok (instance) |
| `result.isErr()` | `() => this is Err<T, E>` | Narrows to Err (instance) |
| `Result.isOk(result)` | `(result: Result<T, E>) => result is Ok<T, E>` | Narrows to Ok (static) |
| `Result.isError(result)` | `(result: Result<T, E>) => result is Err<T, E>` | Narrows to Err (static) |

```typescript
if (result.isOk()) {
  console.log(result.value); // T - narrowed
}

if (result.isErr()) {
  console.log(result.error); // E - narrowed
}
```

## Transforming

All transform methods are available as both instance methods and static (data-last) functions for pipeline composition.

### map

Transform the success value. Errors pass through unchanged.

```typescript
// Instance
result.map(x => x * 2)

// Static (data-first)
Result.map(result, x => x * 2)

// Static (data-last, for pipelines)
Result.map(x => x * 2)(result)
```

### mapError

Transform the error value. Successes pass through unchanged.

```typescript
result.mapError(e => new AppError(e.message))

Result.mapError(result, e => new AppError(e.message))
```

### andThen

Chain a function that returns a new Result. The key method for sequential composition.

```typescript
// Parse then validate
result.andThen(parsed => validate(parsed))

// Static
Result.andThen(result, parsed => validate(parsed))
```

### andThenAsync

Like `andThen` but for async functions.

```typescript
result.andThenAsync(async user => {
  const profile = await fetchProfile(user.id);
  return Result.ok({ ...user, profile });
})
```

## Extracting Values

### unwrap

Extract the value or throw. Use at boundaries where failure is unrecoverable.

```typescript
// Instance - throws on Err
const value = result.unwrap();
const value = result.unwrap("Custom error message");

// Static
Result.unwrap(result);
```

### unwrapOr

Extract the value or return a fallback. Safe alternative to `unwrap`.

```typescript
// Instance
const value = result.unwrapOr(0);        // 0 if Err

// Static (data-first)
Result.unwrapOr(result, 0);

// Static (data-last)
Result.unwrapOr(0)(result);
```

### match

Pattern match on both variants. Exhaustive and type-safe.

```typescript
// Instance
const message = result.match({
  ok: user => `Hello, ${user.name}`,
  err: error => `Error: ${error.message}`,
});

// Static
Result.match(result, {
  ok: user => `Hello, ${user.name}`,
  err: error => `Error: ${error.message}`,
});
```

## Side Effects

### tap

Run a side effect on the success value without changing the result. Errors skip the callback.

```typescript
result
  .tap(user => console.log("Found user:", user.id))
  .map(user => user.name)
```

### tapAsync

Async version of `tap`.

```typescript
await result.tapAsync(async user => {
  await auditLog.record("user_accessed", user.id);
})
```

## Capturing Exceptions

### Result.try

Wrap a synchronous function that might throw.

```typescript
// Simple - wraps in UnhandledException
const parsed = Result.try(() => JSON.parse(rawJson));

// With custom error mapping
const parsed = Result.try({
  try: () => JSON.parse(rawJson),
  catch: (cause) => new ValidationError({ message: `Invalid JSON: ${cause}` }),
});

// With retry
const value = Result.try(() => readFileSync(path), {
  retry: { times: 3 },
});
```

### Result.tryPromise

Wrap an async function that might throw or reject. Supports retry with backoff.

```typescript
// Simple
const response = await Result.tryPromise(() => fetch(url));

// With custom error mapping
const data = await Result.tryPromise({
  try: () => fetch(url).then(r => r.json()),
  catch: (cause) => new NetworkError({ message: String(cause) }),
});

// With retry and exponential backoff
const data = await Result.tryPromise(() => fetch(url), {
  retry: { times: 3, delayMs: 100, backoff: "exponential" },
});

// With conditional retry
const data = await Result.tryPromise({
  try: () => callApi(endpoint),
  catch: (e) => categorizeError(e),
}, {
  retry: {
    times: 3,
    delayMs: 200,
    backoff: "exponential",
    shouldRetry: (e) => e._tag === "NetworkError",
  },
});
```

**Retry options:**

| Option | Type | Description |
|--------|------|-------------|
| `times` | `number` | Max retry attempts |
| `delayMs` | `number` | Base delay between retries |
| `backoff` | `"constant" \| "linear" \| "exponential"` | Delay scaling strategy |
| `shouldRetry` | `(error: E) => boolean` | Predicate to filter retryable errors |

## Generator Composition

### Result.gen

Compose multiple fallible operations using generator syntax. Errors short-circuit — if any `yield*` encounters an Err, the generator returns immediately with that error.

```typescript
const result = Result.gen(function* () {
  const user = yield* getUser(id);       // Err short-circuits here
  const settings = yield* getSettings(user.id);
  return Result.ok({ user, settings });
});
// Result<{ user: User; settings: Settings }, UserError | SettingsError>
```

See [Result Cookbook](./result-cookbook.md) for detailed `Result.gen` patterns.

### Result.await

Wraps `Promise<Result>` to be yieldable in async generator blocks.

```typescript
const result = await Result.gen(async function* () {
  const user = yield* Result.await(fetchUser(id));
  const posts = yield* Result.await(fetchPosts(user.id));
  return Result.ok({ user, posts });
});
```

## Collection Utilities

### Result.partition

Split an array of Results into separate Ok values and Err values.

```typescript
const results = [Result.ok(1), Result.err("a"), Result.ok(2)];
const [values, errors] = Result.partition(results);
// values: [1, 2]
// errors: ["a"]
```

### Result.flatten

Flatten a nested `Result<Result<T, E1>, E2>` into `Result<T, E1 | E2>`.

```typescript
const nested = Result.ok(Result.ok(42));
const flat = Result.flatten(nested); // Ok(42)
```

## Error Serialization

For RPC boundaries and MCP transport. These are standalone functions from `@outfitter/contracts`, not methods on `Result`.

### serializeError

Convert an `OutfitterError` to a JSON-safe `SerializedError` object.

```typescript
import { NotFoundError, serializeError } from "@outfitter/contracts";

const serialized = serializeError(NotFoundError.create("note", "abc123"));
// { _tag: "NotFoundError", category: "not_found", message: "...", context: { resourceType: "note", resourceId: "abc123" } }
```

### deserializeError

Rehydrate a `SerializedError` back into a typed `OutfitterError` instance. Falls back to `InternalError` for unknown tags.

```typescript
import { deserializeError } from "@outfitter/contracts";

const error = deserializeError(serializedPayload);
// Reconstructed NotFoundError with original tag, category, and context
```

## Outfitter Extensions

These utilities are provided by `@outfitter/contracts` on top of better-result.

| Utility | Signature | Description |
|---------|-----------|-------------|
| `expect(result, msg)` | `(result: Result<T, E>, message: string) => T` | Unwrap or throw with context |
| `unwrapOrElse(result, fn)` | `(result: Result<T, E>, fn: (e: E) => T) => T` | Lazy default on error |
| `orElse(result, fallback)` | `(result: Result<T, E>, fallback: Result<T, F>) => Result<T, F>` | First Ok wins |
| `combine2(r1, r2)` | Returns `Result<[T1, T2], E>` | Combine 2 Results into tuple |
| `combine3(r1, r2, r3)` | Returns `Result<[T1, T2, T3], E>` | Combine 3 Results into tuple |

```typescript
import { expect, unwrapOrElse, combine2 } from "@outfitter/contracts";

// expect - boundary helper with context
const config = expect(loadConfig(), "Failed to load config");
// Throws: "Failed to load config: <error details>"

// unwrapOrElse - lazy fallback
const value = unwrapOrElse(result, (error) => computeDefault(error));

// combine2 - tuple composition
const combined = combine2(fetchUser(id), fetchSettings(id));
if (combined.isOk()) {
  const [user, settings] = combined.value;
}
```

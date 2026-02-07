# Result.gen() Cookbook

Generator-based composition for chaining multiple fallible operations. If any `yield*` encounters an Err, the entire block short-circuits and returns that error.

## Why Generators?

Without generators, composing multiple Results requires nested checks:

```typescript
// Verbose: manual isErr guards
const userResult = getUser(id);
if (userResult.isErr()) return userResult;

const settingsResult = getSettings(userResult.value.id);
if (settingsResult.isErr()) return settingsResult;

return Result.ok({ user: userResult.value, settings: settingsResult.value });
```

With `Result.gen`, the same logic is flat and readable:

```typescript
const result = Result.gen(function* () {
  const user = yield* getUser(id);
  const settings = yield* getSettings(user.id);
  return Result.ok({ user, settings });
});
```

## Pattern 1: Sequential Composition

Chain operations where each step depends on the previous.

```typescript
import { Result, NotFoundError, ValidationError } from "@outfitter/contracts";

const createOrder = (userId: string, itemId: string) =>
  Result.gen(function* () {
    const user = yield* findUser(userId);
    const item = yield* findItem(itemId);
    const validated = yield* validateOrder(user, item);
    const order = yield* saveOrder(validated);
    return Result.ok(order);
  });

// Type: Result<Order, NotFoundError | ValidationError | DatabaseError>
// Error type is the union of all yielded errors
```

## Pattern 2: Async Composition

Use `async function*` with `Result.await` to compose async operations.

```typescript
const syncUser = (externalId: string) =>
  Result.gen(async function* () {
    // Result.await wraps Promise<Result> for yielding
    const external = yield* Result.await(fetchExternalUser(externalId));
    const local = yield* Result.await(upsertUser(external));
    const settings = yield* Result.await(syncSettings(local.id, external.preferences));
    return Result.ok({ user: local, settings });
  });

// Returns: Promise<Result<{ user, settings }, ExternalApiError | DatabaseError>>
```

## Pattern 3: Mixing Sync and Async

Sync Results can be yielded directly; async ones need `Result.await`.

```typescript
const processUpload = (file: File) =>
  Result.gen(async function* () {
    // Sync validation - no Result.await needed
    const validated = yield* validateFileType(file);

    // Async operations - wrap with Result.await
    const stored = yield* Result.await(uploadToStorage(validated));
    const record = yield* Result.await(createFileRecord(stored));

    return Result.ok(record);
  });
```

## Pattern 4: Early Return with Conditional Logic

Use standard control flow inside generators.

```typescript
const getOrCreateUser = (email: string) =>
  Result.gen(async function* () {
    const existing = yield* Result.await(findUserByEmail(email));

    // Early return if found
    if (existing) {
      return Result.ok(existing);
    }

    // Otherwise create
    const newUser = yield* Result.await(createUser({ email }));
    yield* Result.await(sendWelcomeEmail(newUser));
    return Result.ok(newUser);
  });
```

**Note:** This pattern requires the `findUserByEmail` to return `Result<User | null, E>` rather than using NotFoundError. For lookup-or-create patterns, prefer returning null/undefined over erroring.

## Pattern 5: Error Type Narrowing with mapError

When composing operations with different error types, normalize them.

```typescript
// Each function returns a different error type
declare function parseConfig(raw: string): Result<Config, ParseError>;
declare function validateConfig(config: Config): Result<Config, ValidationError>;
declare function applyConfig(config: Config): Result<void, ApplyError>;

// Without normalization - union grows
const loose = Result.gen(function* () {
  const parsed = yield* parseConfig(raw);
  const validated = yield* validateConfig(parsed);
  yield* applyConfig(validated);
  return Result.ok(validated);
});
// Result<Config, ParseError | ValidationError | ApplyError>

// With normalization via mapError
const tight = Result.gen(function* () {
  const parsed = yield* parseConfig(raw).mapError(
    (e) => new ConfigError({ message: `Parse: ${e.message}`, phase: "parse" }),
  );
  const validated = yield* validateConfig(parsed).mapError(
    (e) => new ConfigError({ message: `Validate: ${e.message}`, phase: "validate" }),
  );
  yield* applyConfig(validated).mapError(
    (e) => new ConfigError({ message: `Apply: ${e.message}`, phase: "apply" }),
  );
  return Result.ok(validated);
});
// Result<Config, ConfigError>
```

## Pattern 6: Combining Independent Operations

When operations don't depend on each other, use `combine2`/`combine3` or run them in parallel.

```typescript
import { combine2, combine3 } from "@outfitter/contracts";

// Parallel async, then combine
const loadDashboard = async (userId: string) => {
  const [userResult, settingsResult, notifResult] = await Promise.all([
    fetchUser(userId),
    fetchSettings(userId),
    fetchNotifications(userId),
  ]);

  return combine3(userResult, settingsResult, notifResult);
  // Result<[User, Settings, Notification[]], ApiError>
};

// Or inside a gen block
const dashboard = Result.gen(async function* () {
  const [user, settings, notifications] = yield* Result.await(loadDashboard(userId));
  return Result.ok({ user, settings, notifications });
});
```

## Pattern 7: Handler Implementation

The standard Outfitter handler pattern with `Result.gen`.

```typescript
import {
  Result,
  NotFoundError,
  ValidationError,
  type Handler,
  type HandlerContext,
} from "@outfitter/contracts";

interface UpdateProfileInput {
  userId: string;
  displayName: string;
}

interface Profile {
  userId: string;
  displayName: string;
  updatedAt: Date;
}

export const updateProfile: Handler<
  UpdateProfileInput,
  Profile,
  NotFoundError | ValidationError
> = async (input, ctx) =>
  Result.gen(async function* () {
    ctx.logger.debug("Updating profile", { userId: input.userId });

    const user = yield* Result.await(findUser(input.userId));

    const validated = yield* validateDisplayName(input.displayName);

    const profile = yield* Result.await(
      saveProfile({
        userId: user.id,
        displayName: validated,
        updatedAt: new Date(),
      }),
    );

    ctx.logger.info("Profile updated", { userId: user.id });
    return Result.ok(profile);
  });
```

## Return Type Annotations

The generator infers return types automatically. If you need explicit types:

```typescript
// Let TypeScript infer (recommended)
const result = Result.gen(function* () {
  const a = yield* getA(); // Result<A, ErrorA>
  const b = yield* getB(); // Result<B, ErrorB>
  return Result.ok({ a, b });
});
// Inferred: Result<{ a: A; b: B }, ErrorA | ErrorB>

// Explicit annotation on the containing function
function myHandler(): Result<Output, ErrorA | ErrorB> {
  return Result.gen(function* () {
    const a = yield* getA();
    const b = yield* getB();
    return Result.ok({ a, b });
  });
}
```

**Key rule:** The generator's `return` statement must return a `Result` — use `Result.ok(value)` for success or `Result.err(error)` for explicit errors. The `yield*` keyword is what unwraps intermediate Results.

## Common Mistakes

### Forgetting `yield*`

```typescript
// Wrong - result is Result<T, E>, not T
const user = yield getUser(id);

// Right - yield* unwraps the Result
const user = yield* getUser(id);
```

### Forgetting Result.await for async

```typescript
// Wrong - Promise<Result> can't be yielded directly
const user = yield* fetchUser(id);

// Right - wrap async Results
const user = yield* Result.await(fetchUser(id));
```

### Returning raw values

```typescript
// Wrong - must return a Result
return user;

// Right
return Result.ok(user);
```

## See Also

- [RESULT-API.md](./RESULT-API.md) — Full Result API reference
- [PATTERNS.md](./PATTERNS.md) — Handler contract and error taxonomy

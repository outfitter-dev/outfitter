# Stage 2: Handlers

**Status:** ⬜ Not Started
**Blocked By:** Foundation
**Unlocks:** Errors, Adapters

## Objective

Convert functions with `throw` to handlers returning `Result<T, E>`.

## Handlers to Convert



## Conversion Pattern

### Before

```typescript
async function getUser(id: string): Promise<User> {
  const user = await db.users.findById(id);
  if (!user) throw new Error(`Not found: ${id}`);
  return user;
}

try {
  const user = await getUser("123");
} catch (error) {
  console.error(error.message);
}
```

### After

```typescript
import { Result, NotFoundError, type Handler } from "@outfitter/contracts";

const getUser: Handler<{ id: string }, User, NotFoundError> = async (input, ctx) => {
  const user = await db.users.findById(input.id);
  if (!user) return Result.err(new NotFoundError("user", input.id));
  return Result.ok(user);
};

const result = await getUser({ id: "123" }, ctx);
if (result.isErr()) {
  ctx.logger.error("Failed", { error: result.error });
}
```

## Completion Checklist

- [ ] All handlers return `Result<T, E>`
- [ ] No `throw` in handler code
- [ ] Input validation with `createValidator()`
- [ ] Callers check `isOk()` / `isErr()`
- [ ] Tests updated for Result assertions

## Notes



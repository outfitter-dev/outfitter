# Example: Framework Adapters (No Outfitter Runtime)

Shows how to keep domain logic framework-agnostic with a plain TypeScript
`Result` type, then adapt the same handler to Express, Fastify, and Hono.

## Core Domain Handler

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

type User = { readonly id: string; readonly email: string };

type UserError =
  | { readonly type: "not-found"; readonly resource: "user"; readonly id: string }
  | { readonly type: "validation"; readonly field: string; readonly message: string }
  | { readonly type: "network"; readonly message: string };

async function getUser(input: { id: string }): Promise<Result<User, UserError>> {
  if (!input.id) {
    return {
      ok: false,
      error: { type: "validation", field: "id", message: "id is required" },
    };
  }

  const user = await db.users.findById(input.id);
  if (!user) {
    return {
      ok: false,
      error: { type: "not-found", resource: "user", id: input.id },
    };
  }

  return { ok: true, value: user };
}
```

## Shared Error Translator

```typescript
function toHttp(error: UserError): { status: number; body: unknown } {
  switch (error.type) {
    case "validation":
      return { status: 400, body: { error: error.message, field: error.field } };
    case "not-found":
      return {
        status: 404,
        body: { error: `${error.resource} not found`, id: error.id },
      };
    case "network":
      return { status: 502, body: { error: error.message } };
  }
}
```

## Express Adapter

```typescript
app.get("/users/:id", async (req, res) => {
  const result = await getUser({ id: req.params.id });

  if (!result.ok) {
    const { status, body } = toHttp(result.error);
    return res.status(status).json(body);
  }

  return res.status(200).json(result.value);
});
```

## Fastify Adapter

```typescript
fastify.get("/users/:id", async (request, reply) => {
  const result = await getUser({
    id: (request.params as { id: string }).id,
  });

  if (!result.ok) {
    const { status, body } = toHttp(result.error);
    return reply.code(status).send(body);
  }

  return reply.code(200).send(result.value);
});
```

## Hono Adapter

```typescript
import { HTTPException } from "hono/http-exception";

app.get("/users/:id", async (c) => {
  const result = await getUser({ id: c.req.param("id") });

  if (!result.ok) {
    const { status, body } = toHttp(result.error);
    throw new HTTPException(status, {
      message: typeof body === "object" ? JSON.stringify(body) : String(body),
      cause: body,
    });
  }

  return c.json(result.value, 200);
});
```

## Why This Pattern Works

1. Domain logic does not depend on transport or framework APIs.
2. Error handling is typed and exhaustive before reaching the adapter.
3. Swapping frameworks becomes a thin adapter rewrite, not a core rewrite.
4. Outfitter migration later is mechanical: map domain errors to
   `@outfitter/contracts` errors and keep the same handler shape.

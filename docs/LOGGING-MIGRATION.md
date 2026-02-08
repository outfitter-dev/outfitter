# Logging Migration Guide

Outfitter logging is **message-first**: `logger.info("message", { meta })`.
Pino and many other loggers are **object-first**: `logger.info({ meta }, "message")`.

If you keep the object-first order, logs will be malformed. Use this guide to translate common patterns.

## Quick Reference

| Pattern | Pino (object-first) | @outfitter/logging (message-first) |
| --- | --- | --- |
| Basic log | `logger.info({ msg: "hello" })` | `logger.info("hello")` |
| With metadata | `logger.info({ userId: 123 }, "hello")` | `logger.info("hello", { userId: 123 })` |
| Error | `logger.error({ err, msg: "failed" })` | `logger.error("failed", { error: err })` |
| Child logger | `logger.child({ userId })` | `logger.child({ userId })` |

## Examples

### With Metadata

```typescript
logger.info("User created", { userId, plan: "pro" });
```

### Error Logging

```typescript
try {
  await doWork();
} catch (error) {
  logger.error("Work failed", { error });
}
```

### Child Loggers

```typescript
const requestLogger = logger.child({ requestId });
requestLogger.debug("Starting request");
```

## Guardrails

`@outfitter/logging` ships with message-first method signatures. Swapping arguments is a TypeScript error in strict mode.

## Common Pitfalls

- **Object-first habits**: `logger.info({ userId }, "message")` is invalid here.
- **Relying on `msg` key**: prefer the first string argument as the message.
- **Using logs for user output**: logs are for diagnostics. CLI output should go through `@outfitter/cli` output utilities.

## Related Docs

- `docs/PATTERNS.md` — logging vs output responsibilities
- `packages/logging/README.md` — sinks, formatters, redaction

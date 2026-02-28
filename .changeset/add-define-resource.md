---
"@outfitter/mcp": minor
---

Enhance `defineResourceTemplate()` with Zod schema validation for URI template parameters. When `paramSchema` is provided, URI template variables are validated and coerced before handler invocation — parallel to how `defineTool()` validates input. Add `TypedResourceTemplateDefinition<TParams>` type with typed handler. Backward compatible — existing usage without `paramSchema` works unchanged.

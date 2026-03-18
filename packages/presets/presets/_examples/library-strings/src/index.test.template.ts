import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { transform, validate, hash } from "./handlers.js";

const ctx = createContext({ cwd: process.cwd(), env: process.env });

// =============================================================================
// transform
// =============================================================================

describe("transform", () => {
  test("uppercase", async () => {
    const result = await transform(
      { text: "hello world", mode: "uppercase" },
      ctx
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.transformed).toBe("HELLO WORLD");
    expect(result.value.mode).toBe("uppercase");
  });

  test("lowercase", async () => {
    const result = await transform({ text: "HELLO", mode: "lowercase" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.transformed).toBe("hello");
  });

  test("titlecase", async () => {
    const result = await transform(
      { text: "hello world", mode: "titlecase" },
      ctx
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.transformed).toBe("Hello World");
  });

  test("reverse", async () => {
    const result = await transform({ text: "abc", mode: "reverse" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.transformed).toBe("cba");
  });

  test("returns validation error for empty text", async () => {
    const result = await transform({ text: "", mode: "uppercase" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
  });

  test("returns validation error for invalid mode", async () => {
    const result = await transform({ text: "hello", mode: "rot13" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
  });
});

// =============================================================================
// validate
// =============================================================================

describe("validate", () => {
  test("valid email", async () => {
    const result = await validate(
      { value: "user@example.com", format: "email" },
      ctx
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.valid).toBe(true);
  });

  test("invalid email", async () => {
    const result = await validate(
      { value: "not-an-email", format: "email" },
      ctx
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.valid).toBe(false);
  });

  test("valid url", async () => {
    const result = await validate(
      { value: "https://example.com", format: "url" },
      ctx
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.valid).toBe(true);
  });

  test("invalid url", async () => {
    const result = await validate({ value: "not a url", format: "url" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.valid).toBe(false);
  });

  test("valid uuid", async () => {
    const result = await validate(
      { value: "550e8400-e29b-41d4-a716-446655440000", format: "uuid" },
      ctx
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.valid).toBe(true);
  });

  test("returns validation error for empty value", async () => {
    const result = await validate({ value: "", format: "email" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
  });
});

// =============================================================================
// hash
// =============================================================================

describe("hash", () => {
  test("returns sha256 hash", async () => {
    const result = await hash({ text: "hello" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.algorithm).toBe("sha256");
    expect(result.value.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("deterministic output", async () => {
    const r1 = await hash({ text: "test" }, ctx);
    const r2 = await hash({ text: "test" }, ctx);

    expect(r1.isOk() && r2.isOk()).toBe(true);
    if (r1.isErr() || r2.isErr()) return;
    expect(r1.value.hash).toBe(r2.value.hash);
  });

  test("returns validation error for empty text", async () => {
    const result = await hash({ text: "" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
  });
});

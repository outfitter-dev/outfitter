import { describe, expect, test } from "bun:test";

import { createContext } from "@outfitter/contracts";

import { addTodo, listTodos, completeTodo, deleteTodo } from "./handlers.js";

const ctx = createContext({ cwd: process.cwd(), env: process.env });

describe("addTodo", () => {
  test("adds a todo with valid input", async () => {
    const result = await addTodo({ title: "Buy milk" }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.title).toBe("Buy milk");
    expect(result.value.id).toBeGreaterThan(0);
  });

  test("returns validation error for empty title", async () => {
    const result = await addTodo({ title: "" }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ValidationError");
  });
});

describe("listTodos", () => {
  test("lists pending todos by default", async () => {
    const result = await listTodos({ all: false }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.items.length).toBeGreaterThan(0);
  });

  test("lists all todos when all=true", async () => {
    const result = await listTodos({ all: true }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.total).toBeGreaterThanOrEqual(
      result.value.items.length
    );
  });
});

describe("completeTodo", () => {
  test("completes an existing todo", async () => {
    const addResult = await addTodo({ title: "Complete me" }, ctx);
    if (addResult.isErr()) throw new Error("Setup failed");

    const result = await completeTodo({ id: addResult.value.id }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.done).toBe(true);
  });

  test("returns not-found for missing todo", async () => {
    const result = await completeTodo({ id: 99999 }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("NotFoundError");
  });

  test("returns conflict for already-completed todo", async () => {
    const addResult = await addTodo({ title: "Already done" }, ctx);
    if (addResult.isErr()) throw new Error("Setup failed");
    await completeTodo({ id: addResult.value.id }, ctx);

    const result = await completeTodo({ id: addResult.value.id }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("ConflictError");
  });
});

describe("deleteTodo", () => {
  test("deletes an existing todo", async () => {
    const addResult = await addTodo({ title: "Delete me" }, ctx);
    if (addResult.isErr()) throw new Error("Setup failed");

    const result = await deleteTodo({ id: addResult.value.id }, ctx);

    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.deleted).toBe(true);
  });

  test("returns not-found for missing todo", async () => {
    const result = await deleteTodo({ id: 99999 }, ctx);

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.name).toBe("NotFoundError");
  });
});

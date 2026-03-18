/**
 * {{projectName}} core - Todo domain handlers.
 *
 * Pure functions returning `Result<T, E>`. No transport knowledge.
 */

import {
  Result,
  ValidationError,
  NotFoundError,
  ConflictError,
  type HandlerContext,
} from "@outfitter/contracts";
import { createLogger } from "@outfitter/logging";

import {
  addTodoInputSchema,
  listTodosInputSchema,
  completeTodoInputSchema,
  deleteTodoInputSchema,
  type Todo,
  type AddTodoResult,
  type ListTodosResult,
  type CompleteTodoResult,
  type DeleteTodoResult,
} from "./types.js";

const logger = createLogger({ name: "{{projectName}}-core" });

// =============================================================================
// In-memory store (replace with a database in production)
// =============================================================================

const store: Todo[] = [];
let nextId = 1;

// =============================================================================
// Handlers
// =============================================================================

/**
 * Add a new todo item.
 *
 * @param input - Raw input to validate against {@link addTodoInputSchema}
 * @param ctx - Handler context with request metadata
 * @returns New todo details or a `ValidationError`
 */
export async function addTodo(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<AddTodoResult, ValidationError>> {
  const parsed = addTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid todo input",
        field: issue?.path.join(".") || "input",
      })
    );
  }

  const todo: Todo = {
    id: nextId++,
    title: parsed.data.title,
    done: false,
    createdAt: new Date().toISOString(),
  };
  store.push(todo);

  logger.info(`Added todo #${todo.id}`, { requestId: ctx.requestId });
  return Result.ok({ id: todo.id, title: todo.title, total: store.length });
}

/**
 * List todo items, optionally including completed ones.
 *
 * @param input - Raw input to validate against {@link listTodosInputSchema}
 * @param ctx - Handler context with request metadata
 * @returns Filtered todo list with counts
 */
export async function listTodos(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<ListTodosResult, ValidationError>> {
  const parsed = listTodosInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid list input",
        field: issue?.path.join(".") || "input",
      })
    );
  }

  const items = parsed.data.all ? store : store.filter((t) => !t.done);
  const pending = store.filter((t) => !t.done).length;

  logger.info(`Listed ${items.length} todos`, { requestId: ctx.requestId });
  return Result.ok({ items, total: store.length, pending });
}

/**
 * Mark a todo as completed.
 *
 * @param input - Raw input to validate against {@link completeTodoInputSchema}
 * @param ctx - Handler context with request metadata
 * @returns Completed todo or `NotFoundError` / `ConflictError`
 */
export async function completeTodo(
  input: unknown,
  ctx: HandlerContext
): Promise<
  Result<CompleteTodoResult, ValidationError | NotFoundError | ConflictError>
> {
  const parsed = completeTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid complete input",
        field: issue?.path.join(".") || "input",
      })
    );
  }

  const todo = store.find((t) => t.id === parsed.data.id);
  if (!todo) {
    return Result.err(NotFoundError.create("todo", String(parsed.data.id)));
  }

  if (todo.done) {
    return Result.err(
      ConflictError.create(`Todo #${todo.id} is already completed`)
    );
  }

  // Mutate in-memory (safe for demo; use immutable update in production)
  (todo as { done: boolean }).done = true;

  logger.info(`Completed todo #${todo.id}`, { requestId: ctx.requestId });
  return Result.ok({ id: todo.id, title: todo.title, done: true });
}

/**
 * Delete a todo by ID.
 *
 * @param input - Raw input to validate against {@link deleteTodoInputSchema}
 * @param ctx - Handler context with request metadata
 * @returns Deletion confirmation or `NotFoundError`
 */
export async function deleteTodo(
  input: unknown,
  ctx: HandlerContext
): Promise<Result<DeleteTodoResult, ValidationError | NotFoundError>> {
  const parsed = deleteTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Result.err(
      new ValidationError({
        message: issue?.message ?? "Invalid delete input",
        field: issue?.path.join(".") || "input",
      })
    );
  }

  const index = store.findIndex((t) => t.id === parsed.data.id);
  if (index === -1) {
    return Result.err(NotFoundError.create("todo", String(parsed.data.id)));
  }

  store.splice(index, 1);

  logger.info(`Deleted todo #${parsed.data.id}`, { requestId: ctx.requestId });
  return Result.ok({ id: parsed.data.id, deleted: true });
}

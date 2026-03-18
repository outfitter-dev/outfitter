import { type ZodType, z } from "zod";

// =============================================================================
// Domain types
// =============================================================================

/** A todo item in the store. */
export interface Todo {
  readonly id: number;
  readonly title: string;
  readonly done: boolean;
  readonly createdAt: string;
}

// =============================================================================
// Input schemas
// =============================================================================

/** Input for adding a todo. */
export interface AddTodoInput {
  readonly title: string;
}

/** Zod schema for validating add-todo input. */
export const addTodoInputSchema: ZodType<AddTodoInput> = z.object({
  title: z.string().min(1, "title is required"),
});

/** Input for listing todos. */
export interface ListTodosInput {
  readonly all: boolean;
}

/** Zod schema for validating list-todos input. */
export const listTodosInputSchema: ZodType<ListTodosInput> = z.object({
  all: z.boolean().default(false),
});

/** Input for completing a todo. */
export interface CompleteTodoInput {
  readonly id: number;
}

/** Zod schema for validating complete-todo input. */
export const completeTodoInputSchema: ZodType<CompleteTodoInput> = z.object({
  id: z.number().int().positive("id must be a positive integer"),
});

/** Input for deleting a todo. */
export interface DeleteTodoInput {
  readonly id: number;
}

/** Zod schema for validating delete-todo input. */
export const deleteTodoInputSchema: ZodType<DeleteTodoInput> = z.object({
  id: z.number().int().positive("id must be a positive integer"),
});

// =============================================================================
// Output types
// =============================================================================

/** Result of adding a todo. */
export interface AddTodoResult {
  readonly id: number;
  readonly title: string;
  readonly total: number;
}

/** Result of listing todos. */
export interface ListTodosResult {
  readonly items: ReadonlyArray<Todo>;
  readonly total: number;
  readonly pending: number;
}

/** Result of completing a todo. */
export interface CompleteTodoResult {
  readonly id: number;
  readonly title: string;
  readonly done: boolean;
}

/** Result of deleting a todo. */
export interface DeleteTodoResult {
  readonly id: number;
  readonly deleted: boolean;
}

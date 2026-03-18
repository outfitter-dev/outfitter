/**
 * {{projectName}} action registry.
 *
 * Actions are the canonical unit of CLI and MCP functionality.
 * Define once, expose on both surfaces.
 *
 * @packageDocumentation
 */

import {
  type ActionRegistry,
  createActionRegistry,
  defineAction,
  type ValidationError,
  type NotFoundError,
  type ConflictError,
} from "@outfitter/contracts";
import { z } from "zod";

import { addTodo, listTodos, completeTodo, deleteTodo } from "./handlers.js";
import type {
  AddTodoResult,
  ListTodosResult,
  CompleteTodoResult,
  DeleteTodoResult,
} from "./types.js";

export const addAction = defineAction<unknown, AddTodoResult, ValidationError>({
  id: "todo.add",
  description: "Add a new todo item",
  surfaces: ["cli", "mcp"],
  input: z.object({
    title: z.string().min(1, "title is required"),
  }),
  cli: {
    command: "add",
    description: "Add a new todo item",
    options: [
      {
        flags: "--title <title>",
        description: "Title of the todo item",
      },
    ],
    mapInput: ({ flags }) => ({
      title: String(flags["title"] ?? ""),
    }),
  },
  mcp: {
    tool: "todo_add",
    description: "Add a new todo item",
  },
  handler: addTodo,
});

export const listAction = defineAction<
  unknown,
  ListTodosResult,
  ValidationError
>({
  id: "todo.list",
  description: "List todo items",
  surfaces: ["cli", "mcp"],
  input: z.object({
    all: z.boolean().default(false),
  }),
  cli: {
    command: "list",
    description: "List todo items",
    options: [
      {
        flags: "--all",
        description: "Show completed todos too",
        defaultValue: false,
      },
    ],
    mapInput: ({ flags }) => ({
      all: Boolean(flags["all"]),
    }),
  },
  mcp: {
    tool: "todo_list",
    description: "List todo items",
    readOnly: true,
  },
  handler: listTodos,
});

export const completeAction = defineAction<
  unknown,
  CompleteTodoResult,
  ValidationError | NotFoundError | ConflictError
>({
  id: "todo.complete",
  description: "Mark a todo as completed",
  surfaces: ["cli", "mcp"],
  input: z.object({
    id: z.number().int().positive("id must be a positive integer"),
  }),
  cli: {
    command: "complete",
    description: "Mark a todo as completed",
    options: [
      {
        flags: "--id <id>",
        description: "ID of the todo to complete",
      },
    ],
    mapInput: ({ flags }) => ({
      id: Number(flags["id"]),
    }),
  },
  mcp: {
    tool: "todo_complete",
    description: "Mark a todo as completed",
  },
  handler: completeTodo,
});

export const deleteAction = defineAction<
  unknown,
  DeleteTodoResult,
  ValidationError | NotFoundError
>({
  id: "todo.delete",
  description: "Delete a todo item",
  surfaces: ["cli", "mcp"],
  input: z.object({
    id: z.number().int().positive("id must be a positive integer"),
  }),
  cli: {
    command: "delete",
    description: "Delete a todo item",
    options: [
      {
        flags: "--id <id>",
        description: "ID of the todo to delete",
      },
    ],
    mapInput: ({ flags }) => ({
      id: Number(flags["id"]),
    }),
  },
  mcp: {
    tool: "todo_delete",
    description: "Delete a todo item",
  },
  handler: deleteTodo,
});

/** Create the action registry with all todo actions. */
export function createRegistry(): ActionRegistry {
  const registry = createActionRegistry();
  registry.add(addAction);
  registry.add(listAction);
  registry.add(completeAction);
  registry.add(deleteAction);
  return registry;
}

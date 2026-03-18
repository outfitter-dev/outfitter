/**
 * {{projectName}}
 *
 * {{description}}
 *
 * @packageDocumentation
 */

import { NotFoundError, Result, ValidationError } from "@outfitter/contracts";

export interface Greeting {
  readonly message: string;
}

/**
 * Generate a greeting for the given name.
 *
 * @param name - Name to greet
 * @returns Greeting message on success, ValidationError if name is empty
 */
export function greet(name: string): Result<Greeting, ValidationError> {
  if (!name) {
    return Result.err(ValidationError.create("name", "name is required"));
  }

  return Result.ok({ message: `Hello, ${name}!` });
}

/**
 * Find a greeting by ID.
 *
 * @param id - Greeting identifier to look up
 * @returns Greeting on success, NotFoundError when ID does not exist
 */
export function find(id: string): Result<Greeting, NotFoundError> {
  if (!id || id === "unknown") {
    return Result.err(NotFoundError.create("greeting", id || "<empty>"));
  }

  return Result.ok({ message: `Hello from greeting ${id}!` });
}

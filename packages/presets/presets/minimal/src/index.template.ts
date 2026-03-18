/**
 * {{projectName}}
 *
 * {{description}}
 *
 * @packageDocumentation
 */

import { Result, ValidationError } from "@outfitter/contracts";

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

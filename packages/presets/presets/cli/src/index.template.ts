/**
 * {{projectName}} - Public API exports
 *
 * @packageDocumentation
 */

export { program } from "./program.js";
export { greet, lookup } from "./commands/hello.js";
export type {
  GreetingInput,
  GreetingOutput,
  LookupInput,
  LookupOutput,
} from "./types.js";

/**
 * Result utilities
 *
 * Extends better-result with additional combinators.
 *
 * @module result
 */

// eslint-disable-next-line oxc/no-barrel-file -- intentional re-export for API surface
export {
  combine2,
  combine3,
  expect,
  orElse,
  unwrapOrElse,
} from "./utilities.js";

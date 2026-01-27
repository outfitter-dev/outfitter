/**
 * @outfitter/types - Branded types, type guards, and type utilities
 *
 * @packageDocumentation
 */

// Branded type utilities
export {
  type Branded,
  type BrandOf,
  brand,
  type Email,
  email,
  type NonEmptyString,
  nonEmptyString,
  type PositiveInt,
  positiveInt,
  type Unbrand,
  type UUID,
  unbrand,
  uuid,
} from "./branded";
// Collection utilities
export {
  first,
  groupBy,
  isNonEmptyArray,
  last,
  type NonEmptyArray,
  toNonEmptyArray,
} from "./collections";
// Deep path utilities
export type { DeepGet, DeepKeys, DeepSet } from "./deep";

// Type guards
export {
  assertType,
  createGuard,
  hasProperty,
  isDefined,
  isNonEmptyString,
  isPlainObject,
} from "./guards";
// Deterministic hash ID generation
export { hashId } from "./hash-id";
// Short ID generation
export {
  isShortId,
  type ShortId,
  type ShortIdOptions,
  shortId,
} from "./short-id";
// Type utilities
export {
  type AtLeastOne,
  assertNever,
  type DeepPartial,
  type DeepReadonly,
  type ElementOf,
  type ExactlyOne,
  type Mutable,
  type OptionalKeys,
  type RequiredKeys,
  type ValueOf,
} from "./utilities";

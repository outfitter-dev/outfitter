/**
 * @outfitter/types - Branded types, type guards, and type utilities
 *
 * @packageDocumentation
 */

// Branded type utilities
export {
	brand,
	unbrand,
	type Branded,
	type Unbrand,
	type BrandOf,
} from "./branded";

// Short ID generation
export { shortId, isShortId, type ShortId, type ShortIdOptions } from "./short-id";

// Type guards
export {
	isDefined,
	isNonEmptyString,
	isPlainObject,
	hasProperty,
	createGuard,
	assertType,
} from "./guards";

// Collection utilities
export {
	isNonEmptyArray,
	toNonEmptyArray,
	first,
	last,
	groupBy,
	type NonEmptyArray,
} from "./collections";

// Type utilities
export {
	assertNever,
	type RequiredKeys,
	type OptionalKeys,
	type DeepReadonly,
	type DeepPartial,
	type AtLeastOne,
	type ExactlyOne,
	type ElementOf,
	type ValueOf,
	type Mutable,
} from "./utilities";

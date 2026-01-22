/**
 * General type utilities for TypeScript.
 *
 * @module utilities
 */

/**
 * Makes specific properties of a type required.
 *
 * @example
 * ```typescript
 * interface Config { host?: string; port?: number; }
 * type RequiredHost = RequiredKeys<Config, "host">;
 * // { host: string; port?: number; }
 * ```
 */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes specific properties of a type optional.
 *
 * @example
 * ```typescript
 * interface User { id: string; name: string; email: string; }
 * type PartialUser = OptionalKeys<User, "email">;
 * // { id: string; name: string; email?: string; }
 * ```
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Deeply makes all properties readonly.
 */
export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Deeply makes all properties partial (optional).
 */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Creates a type that requires at least one of the specified keys.
 *
 * @example
 * ```typescript
 * type Props = AtLeastOne<{ a?: string; b?: number; c?: boolean }, "a" | "b">;
 * // Must have at least 'a' or 'b'
 * ```
 */
export type AtLeastOne<T, Keys extends keyof T = keyof T> = Omit<T, Keys> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
	}[Keys];

/**
 * Creates a type that requires exactly one of the specified keys.
 *
 * @example
 * ```typescript
 * type Auth = ExactlyOne<{ token?: string; apiKey?: string }, "token" | "apiKey">;
 * // Must have exactly one of 'token' or 'apiKey', not both
 * ```
 */
export type ExactlyOne<T, Keys extends keyof T = keyof T> = Omit<T, Keys> &
	{
		[K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, never>>;
	}[Keys];

/**
 * Extracts the element type from an array type.
 */
export type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

/**
 * Creates a union type from object values.
 */
export type ValueOf<T> = T[keyof T];

/**
 * Makes a type's properties mutable (removes readonly).
 */
export type Mutable<T> = {
	-readonly [P in keyof T]: T[P];
};

/**
 * Asserts at compile time that a type is never (exhaustiveness check).
 *
 * @param value - The value that should be never
 * @throws Error - Always throws if reached at runtime
 *
 * @example
 * ```typescript
 * type Status = "pending" | "done";
 * function handle(status: Status) {
 *   switch (status) {
 *     case "pending": return "...";
 *     case "done": return "ok";
 *     default: return assertNever(status);
 *   }
 * }
 * ```
 */
export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

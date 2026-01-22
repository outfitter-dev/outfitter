import type { Result } from "better-result";
import { type KitError, type SerializedError, statusCodeMap } from "./errors.js";
import { serializeError } from "./serialization.js";
import { generateRequestId } from "./context.js";

/**
 * Metadata attached to every response envelope.
 */
export interface EnvelopeMeta {
	/** Unique request identifier for tracing */
	requestId: string;

	/** ISO timestamp of response generation */
	timestamp: string;

	/** Operation duration in milliseconds */
	durationMs?: number;
}

/**
 * Pagination metadata for list responses.
 */
export interface PaginationMeta {
	/** Total number of items (if known) */
	total?: number;

	/** Number of items returned */
	count: number;

	/** Cursor for next page (null if no more pages) */
	nextCursor: string | null;

	/** Whether more pages exist */
	hasMore: boolean;
}

/**
 * Success envelope structure.
 */
export interface SuccessEnvelope<T> {
	ok: true;
	data: T;
	meta: EnvelopeMeta;
	pagination?: PaginationMeta;
}

/**
 * Error envelope structure.
 */
export interface ErrorEnvelope {
	ok: false;
	error: SerializedError;
	meta: EnvelopeMeta;
}

/**
 * Response envelope - consistent wrapper for all handler responses.
 */
export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/**
 * HTTP-style response with status code.
 */
export interface HttpResponse<T> {
	status: number;
	body: Envelope<T>;
}

/**
 * Build envelope metadata with defaults.
 */
function buildMeta(overrides?: Partial<EnvelopeMeta>): EnvelopeMeta {
	const meta: EnvelopeMeta = {
		requestId: overrides?.requestId ?? generateRequestId(),
		timestamp: new Date().toISOString(),
	};

	if (overrides?.durationMs !== undefined) {
		meta.durationMs = overrides.durationMs;
	}

	return meta;
}

/**
 * Convert a Result to a response envelope.
 *
 * @typeParam T - Success data type
 * @typeParam E - Error type (extends KitError)
 * @param result - Handler result to wrap
 * @param meta - Optional metadata overrides
 * @returns Envelope with success data or serialized error
 *
 * @example
 * ```typescript
 * const result = await getNote({ id: "abc123" }, ctx);
 * const envelope = toEnvelope(result, { requestId: ctx.requestId });
 * ```
 */
export function toEnvelope<T, E extends KitError>(
	result: Result<T, E>,
	meta?: Partial<EnvelopeMeta>,
): Envelope<T> {
	const envelopeMeta = buildMeta(meta);

	if (result.isOk()) {
		return {
			ok: true,
			data: result.value,
			meta: envelopeMeta,
		};
	}

	return {
		ok: false,
		error: serializeError(result.error),
		meta: envelopeMeta,
	};
}

/**
 * Convert a Result to HTTP-style response (for MCP over HTTP).
 *
 * Maps error category to appropriate HTTP status code.
 *
 * @typeParam T - Success data type
 * @typeParam E - Error type (extends KitError)
 * @param result - Handler result to convert
 * @returns HTTP response with status code and envelope body
 *
 * @example
 * ```typescript
 * const result = await getNote({ id: "abc123" }, ctx);
 * const response = toHttpResponse(result);
 * // { status: 200, body: { ok: true, data: note, meta: {...} } }
 * // or { status: 404, body: { ok: false, error: {...}, meta: {...} } }
 * ```
 */
export function toHttpResponse<T, E extends KitError>(result: Result<T, E>): HttpResponse<T> {
	const envelope = toEnvelope(result);

	if (envelope.ok) {
		return {
			status: 200,
			body: envelope,
		};
	}

	// Get status code from error category
	const status = statusCodeMap[envelope.error.category];

	return {
		status,
		body: envelope,
	};
}

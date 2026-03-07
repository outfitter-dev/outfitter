/* eslint-disable outfitter/max-file-lines -- Cursor creation and encoding helpers are easier to audit in one module. */
/**
 * Cursor creation, manipulation, encoding, and decoding functions.
 *
 * @module
 */

import { Result, ValidationError } from "@outfitter/contracts";

import type { CreateCursorOptions, Cursor } from "./types.js";

// ============================================================================
// Cursor Functions
// ============================================================================

/**
 * Create a new pagination cursor.
 *
 * Cursors are immutable and frozen. To update position, use {@link advanceCursor}.
 * If no ID is provided, a UUID is generated automatically.
 *
 * @param options - Cursor creation options including position, optional ID, metadata, and TTL
 * @returns Result containing frozen Cursor or ValidationError if position is negative
 *
 * @example
 * ```typescript
 * // Basic cursor at position 0
 * const result = createCursor({ position: 0 });
 *
 * // Cursor with metadata and TTL
 * const result = createCursor({
 *   position: 0,
 *   metadata: { filter: "active" },
 *   ttl: 3600000, // 1 hour
 * });
 *
 * if (result.isOk()) {
 *   store.set(result.value);
 * }
 * ```
 */
export function createCursor(
  options: CreateCursorOptions
): Result<Cursor, InstanceType<typeof ValidationError>> {
  // Validate position is non-negative
  if (options.position < 0) {
    return Result.err(
      new ValidationError({
        message: "Position must be non-negative",
        field: "position",
      })
    );
  }

  const createdAt = Date.now();
  const id = options.id ?? crypto.randomUUID();

  // Build cursor with conditional optional properties
  // Using exactOptionalPropertyTypes means we can't set undefined for optional props
  const cursor: Cursor = Object.freeze({
    id,
    position: options.position,
    createdAt,
    ...(options.metadata !== undefined && { metadata: options.metadata }),
    ...(options.ttl !== undefined && { ttl: options.ttl }),
    ...(options.ttl !== undefined && { expiresAt: createdAt + options.ttl }),
  });

  return Result.ok(cursor);
}

/**
 * Advance a cursor to a new position, returning a new immutable cursor.
 *
 * The original cursor is not modified. All properties (ID, metadata, TTL,
 * expiresAt, createdAt) are preserved in the new cursor.
 *
 * @param cursor - The cursor to advance (not modified)
 * @param newPosition - The new position value (typically cursor.position + pageSize)
 * @returns A new frozen Cursor with the updated position
 *
 * @example
 * ```typescript
 * const cursor = createCursor({ position: 0 });
 * if (cursor.isOk()) {
 *   // Advance by page size of 25
 *   const nextPage = advanceCursor(cursor.value, cursor.value.position + 25);
 *
 *   console.log(cursor.value.position); // 0 (unchanged)
 *   console.log(nextPage.position);     // 25
 *
 *   // Store the advanced cursor
 *   store.set(nextPage);
 * }
 * ```
 */
export function advanceCursor(cursor: Cursor, newPosition: number): Cursor {
  // Build new cursor preserving optional properties
  const newCursor: Cursor = Object.freeze({
    id: cursor.id,
    position: newPosition,
    createdAt: cursor.createdAt,
    ...(cursor.metadata !== undefined && { metadata: cursor.metadata }),
    ...(cursor.ttl !== undefined && { ttl: cursor.ttl }),
    ...(cursor.expiresAt !== undefined && { expiresAt: cursor.expiresAt }),
  });

  return newCursor;
}

/**
 * Check if a cursor has expired based on its TTL.
 *
 * Cursors without a TTL (no `expiresAt` property) never expire and
 * this function will always return `false` for them.
 *
 * @param cursor - The cursor to check for expiration
 * @returns `true` if cursor has expired, `false` if still valid or has no TTL
 *
 * @example
 * ```typescript
 * const cursor = createCursor({ position: 0, ttl: 1000 }); // 1 second TTL
 *
 * if (cursor.isOk()) {
 *   console.log(isExpired(cursor.value)); // false (just created)
 *
 *   // Wait 2 seconds...
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *
 *   console.log(isExpired(cursor.value)); // true (expired)
 * }
 *
 * // Cursors without TTL never expire
 * const eternal = createCursor({ position: 0 });
 * if (eternal.isOk()) {
 *   console.log(isExpired(eternal.value)); // always false
 * }
 * ```
 */
export function isExpired(cursor: Cursor): boolean {
  // Cursors without TTL never expire
  if (cursor.expiresAt === undefined) {
    return false;
  }
  return Date.now() > cursor.expiresAt;
}

// ============================================================================
// Base64 Helpers
// ============================================================================

/**
 * Converts standard base64 to URL-safe base64.
 * Replaces + with -, / with _, and removes = padding.
 */
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const base64Encoder = new TextEncoder();
const base64Decoder = new TextDecoder();

/**
 * Converts UTF-8 text to standard base64.
 */
function toBase64(value: string): string {
  const bytes = base64Encoder.encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Converts standard base64 to UTF-8 text.
 */
function fromBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return base64Decoder.decode(bytes);
}

/**
 * Converts URL-safe base64 to standard base64.
 * Replaces - with +, _ with /, and adds padding if needed.
 */
function fromBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padLength = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(padLength);
  return base64;
}

// ============================================================================
// Cursor Encoding/Decoding
// ============================================================================

/**
 * Encodes a cursor to an opaque URL-safe string.
 *
 * The internal structure is hidden from consumers. The cursor is serialized
 * to JSON and then encoded using URL-safe base64 (RFC 4648 Section 5).
 *
 * @param cursor - Cursor to encode
 * @returns URL-safe base64 encoded string (no +, /, or = characters)
 *
 * @example
 * ```typescript
 * const cursor = createCursor({ position: 0, metadata: { query: "status:open" } });
 * if (cursor.isOk()) {
 *   const encoded = encodeCursor(cursor.value);
 *   // encoded is a URL-safe string like "eyJpZCI6IjEyMzQ..."
 *
 *   // Can be safely used in URLs, query params, headers
 *   const url = `/api/items?cursor=${encoded}`;
 * }
 * ```
 */
export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify(cursor);
  // Encode to standard base64, then convert to URL-safe
  const base64 = toBase64(json);
  return toBase64Url(base64);
}

/**
 * Decodes an opaque cursor string back to a Cursor.
 *
 * Validates the structure after decoding, ensuring all required fields
 * are present and have correct types.
 *
 * @param encoded - URL-safe base64 encoded cursor
 * @returns Result with decoded Cursor or ValidationError if invalid
 *
 * @example
 * ```typescript
 * // Successful decode
 * const result = decodeCursor(encodedString);
 * if (result.isOk()) {
 *   console.log(result.value.position);
 * }
 *
 * // Handle invalid input
 * const invalid = decodeCursor("not-a-valid-cursor");
 * if (invalid.isErr()) {
 *   console.log(invalid.error.message); // "Invalid cursor: ..."
 * }
 * ```
 */
export function decodeCursor(
  encoded: string
): Result<Cursor, InstanceType<typeof ValidationError>> {
  // Step 1: Decode base64
  let json: string;
  try {
    const base64 = fromBase64Url(encoded);
    json = fromBase64(base64);
  } catch {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: failed to decode base64",
        field: "cursor",
      })
    );
  }

  // Step 2: Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: failed to parse JSON",
        field: "cursor",
      })
    );
  }

  // Step 3: Validate structure
  if (typeof data !== "object" || data === null) {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: expected object",
        field: "cursor",
      })
    );
  }

  interface ParsedCursor {
    createdAt: number;
    expiresAt?: number;
    id: string;
    metadata?: Record<string, unknown>;
    position: number;
    ttl?: number;
  }

  const obj = data as Partial<ParsedCursor>;

  // Validate required fields
  if (typeof obj.id !== "string") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: missing or invalid 'id' field",
        field: "cursor.id",
      })
    );
  }

  if (typeof obj.position !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: missing or invalid 'position' field",
        field: "cursor.position",
      })
    );
  }

  // Reject negative positions (matches createCursor validation)
  if (obj.position < 0) {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: position must be non-negative",
        field: "cursor.position",
      })
    );
  }

  if (typeof obj.createdAt !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: missing or invalid 'createdAt' field",
        field: "cursor.createdAt",
      })
    );
  }

  // Validate optional fields if present
  if (
    obj.metadata !== undefined &&
    (typeof obj.metadata !== "object" || obj.metadata === null)
  ) {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: 'metadata' must be an object",
        field: "cursor.metadata",
      })
    );
  }

  if (obj.ttl !== undefined && typeof obj.ttl !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: 'ttl' must be a number",
        field: "cursor.ttl",
      })
    );
  }

  if (obj.expiresAt !== undefined && typeof obj.expiresAt !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: 'expiresAt' must be a number",
        field: "cursor.expiresAt",
      })
    );
  }

  // Build the cursor with proper typing
  const cursor: Cursor = Object.freeze({
    id: obj.id,
    position: obj.position,
    createdAt: obj.createdAt,
    ...(obj.metadata !== undefined && {
      metadata: obj.metadata as Record<string, unknown>,
    }),
    ...(obj.ttl !== undefined && { ttl: obj.ttl }),
    ...(obj.expiresAt !== undefined && { expiresAt: obj.expiresAt }),
  });

  return Result.ok(cursor);
}

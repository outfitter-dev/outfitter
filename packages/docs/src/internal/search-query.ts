/**
 * FTS5 query normalization utilities.
 *
 * Provides retry logic for plain-text queries that trip FTS5 syntax
 * errors (e.g. punctuation in "result-api" or "async/await").
 *
 * @packageDocumentation
 */

/** Matches FTS5 parser/column errors. */
const FTS_ERROR_PATTERN = /(fts5:|no such column:)/i;
/** Matches explicit FTS5 query syntax characters. */
const FTS_SYNTAX_PATTERN = /["*:()]/;
/** Matches FTS5 boolean operators as standalone tokens. */
const FTS_OPERATOR_PATTERN = /(^|[\s(])(AND|OR|NOT|NEAR)(?=$|[\s)])/i;

/**
 * Check whether an error message indicates an FTS5 parse failure.
 *
 * @param message - Error message to check
 * @returns True if the message looks like an FTS5 syntax error
 *
 * @example
 * ```typescript
 * isFtsParseError("fts5: syntax error near \":\"") // true
 * isFtsParseError("connection refused")             // false
 * ```
 */
export function isFtsParseError(message: string): boolean {
  return FTS_ERROR_PATTERN.test(message);
}

/**
 * Check whether a query string contains explicit FTS5 syntax.
 *
 * Queries with syntax characters or boolean operators should not be
 * retried with quoting — the user intentionally wrote FTS5 syntax.
 *
 * @param query - Search query string
 * @returns True if the query contains FTS5 syntax or operators
 *
 * @example
 * ```typescript
 * hasFtsSyntax("hello AND world") // true
 * hasFtsSyntax("result-api")      // false
 * ```
 */
export function hasFtsSyntax(query: string): boolean {
  return FTS_SYNTAX_PATTERN.test(query) || FTS_OPERATOR_PATTERN.test(query);
}

/**
 * Quote each whitespace-delimited term so FTS5 treats punctuation as literal.
 *
 * Used as a fallback when a plain-text query (without explicit FTS5
 * syntax) trips a parse error. Wrapping terms in double quotes makes
 * FTS5 treat them as phrase literals.
 *
 * @param query - Plain-text search query
 * @returns Query with each term quoted
 *
 * @example
 * ```typescript
 * quoteFtsTerms("result-api") // '"result-api"'
 * quoteFtsTerms("async/await helpers") // '"async/await" "helpers"'
 * ```
 */
export function quoteFtsTerms(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"`)
    .join(" ");
}

/**
 * Determine whether a failed search query should be retried with quoted terms.
 *
 * Returns true when the error looks like an FTS5 parse failure and the
 * query does not contain explicit FTS5 syntax (meaning the user wrote
 * plain text that happened to confuse the parser).
 *
 * @param query - The original query string
 * @param errorMessage - The error message from the failed search
 * @returns True if the query should be retried with {@link quoteFtsTerms}
 *
 * @example
 * ```typescript
 * shouldRetryAsQuoted("result-api", "fts5: syntax error") // true
 * shouldRetryAsQuoted('"hello"', "fts5: syntax error")    // false
 * ```
 */
export function shouldRetryAsQuoted(
  query: string,
  errorMessage: string
): boolean {
  return isFtsParseError(errorMessage) && !hasFtsSyntax(query);
}

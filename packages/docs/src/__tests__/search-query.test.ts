/**
 * Tests for FTS5 query normalization utilities.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import {
  hasFtsSyntax,
  isFtsParseError,
  quoteFtsTerms,
  shouldRetryAsQuoted,
} from "../search.js";

describe("isFtsParseError", () => {
  test("detects fts5 errors", () => {
    expect(isFtsParseError("fts5: syntax error")).toBe(true);
    expect(isFtsParseError("FTS5: parse error")).toBe(true);
  });

  test("detects column errors", () => {
    expect(isFtsParseError("no such column: foo")).toBe(true);
  });

  test("rejects unrelated errors", () => {
    expect(isFtsParseError("connection refused")).toBe(false);
    expect(isFtsParseError("SQLITE_BUSY")).toBe(false);
  });
});

describe("hasFtsSyntax", () => {
  test("detects quoted phrases", () => {
    expect(hasFtsSyntax('"hello world"')).toBe(true);
  });

  test("detects wildcard", () => {
    expect(hasFtsSyntax("hel*")).toBe(true);
  });

  test("detects column prefix", () => {
    expect(hasFtsSyntax("title:hello")).toBe(true);
  });

  test("detects boolean operators", () => {
    expect(hasFtsSyntax("hello AND world")).toBe(true);
    expect(hasFtsSyntax("hello OR world")).toBe(true);
    expect(hasFtsSyntax("NOT hello")).toBe(true);
    expect(hasFtsSyntax("NEAR(hello, world)")).toBe(true);
  });

  test("rejects plain text", () => {
    expect(hasFtsSyntax("hello world")).toBe(false);
    expect(hasFtsSyntax("result-api")).toBe(false);
    expect(hasFtsSyntax("async/await")).toBe(false);
  });
});

describe("quoteFtsTerms", () => {
  test("quotes single term", () => {
    expect(quoteFtsTerms("result-api")).toBe('"result-api"');
  });

  test("quotes multiple terms", () => {
    expect(quoteFtsTerms("async/await helpers")).toBe(
      '"async/await" "helpers"'
    );
  });

  test("escapes embedded double quotes", () => {
    expect(quoteFtsTerms('say "hello"')).toBe('"say" """hello"""');
  });

  test("trims and normalizes whitespace", () => {
    expect(quoteFtsTerms("  hello   world  ")).toBe('"hello" "world"');
  });

  test("handles empty string", () => {
    expect(quoteFtsTerms("")).toBe("");
    expect(quoteFtsTerms("   ")).toBe("");
  });
});

describe("shouldRetryAsQuoted", () => {
  test("true for FTS error on plain text", () => {
    expect(shouldRetryAsQuoted("result-api", "fts5: syntax error")).toBe(true);
  });

  test("false for FTS error on FTS syntax query", () => {
    expect(shouldRetryAsQuoted('"hello"', "fts5: syntax error")).toBe(false);
  });

  test("false for non-FTS error", () => {
    expect(shouldRetryAsQuoted("hello", "connection refused")).toBe(false);
  });
});

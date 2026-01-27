/**
 * Outfitter CLI public API smoke tests.
 *
 * Ensures exports load without executing the CLI entrypoint.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { InitError, initCommand } from "../index.js";

describe("outfitter public API", () => {
  test("exports initCommand", () => {
    expect(typeof initCommand).toBe("function");
  });

  test("exports InitError", () => {
    const err = new InitError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("InitError");
  });
});

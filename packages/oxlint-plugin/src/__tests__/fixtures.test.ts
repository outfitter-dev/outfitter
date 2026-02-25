import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(TEST_DIR, "fixtures");

describe("rule test fixtures", () => {
  test("provides valid and invalid fixture directories", () => {
    expect(existsSync(join(FIXTURES_DIR, "valid"))).toBe(true);
    expect(existsSync(join(FIXTURES_DIR, "invalid"))).toBe(true);
  });
});

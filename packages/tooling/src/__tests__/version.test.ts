import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { VERSION } from "../version.js";

const PACKAGE_ROOT = join(import.meta.dir, "../..");

describe("VERSION", () => {
  test("matches package.json version", () => {
    const packageJson = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")
    ) as { version: string };

    expect(VERSION).toBe(packageJson.version);
  });

  test("is a non-empty string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });

  test("is a valid semver-like string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("is not the fallback version", () => {
    // The actual package always has a real version set
    expect(VERSION).not.toBe("0.0.0");
  });
});

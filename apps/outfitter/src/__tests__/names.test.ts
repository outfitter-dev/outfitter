/**
 * Tests for package/path name helpers.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { isPathWithin, validatePackageName } from "../engine/names.js";

describe("isPathWithin", () => {
  test("allows directory names that start with '..' but are not parent traversals", () => {
    const base = resolve("/tmp", "workspace", "apps");
    const target = join(base, "..cache", "my-app");

    expect(isPathWithin(base, target)).toBe(true);
  });

  test("rejects real parent-directory traversal", () => {
    const base = resolve("/tmp", "workspace", "apps");
    const escaped = resolve(base, "..", "outside");

    expect(isPathWithin(base, escaped)).toBe(false);
  });
});

describe("validatePackageName", () => {
  test("allows scoped package names with scope segments starting with '.' or '_'", () => {
    expect(validatePackageName("@_acme/tool")).toBeUndefined();
    expect(validatePackageName("@.acme/tool")).toBeUndefined();
  });

  test("still rejects package name segments that start with '.' or '_'", () => {
    expect(validatePackageName("_tool")).toContain("must not start");
    expect(validatePackageName(".tool")).toContain("must not start");
    expect(validatePackageName("@acme/_tool")).toContain("must not start");
    expect(validatePackageName("@acme/.tool")).toContain("must not start");
  });
});

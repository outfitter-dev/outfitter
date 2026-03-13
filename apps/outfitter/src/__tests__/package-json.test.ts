import { describe, expect, test } from "bun:test";

import {
  normalizePackageJsonForWrite,
  serializePackageJson,
} from "../engine/package-json.js";

describe("normalizePackageJsonForWrite", () => {
  test("places known keys before unknown ones", () => {
    const result = normalizePackageJsonForWrite({
      scripts: {},
      name: "pkg",
      custom: "value",
      version: "1.0.0",
    });

    expect(Object.keys(result)).toEqual([
      "name",
      "version",
      "scripts",
      "custom",
    ]);
  });

  test("unknown keys are appended in original order", () => {
    const result = normalizePackageJsonForWrite({ z: 1, a: 2 });

    expect(Object.keys(result)).toEqual(["z", "a"]);
  });

  test("sorts dependency sections alphabetically", () => {
    const result = normalizePackageJsonForWrite({
      name: "pkg",
      dependencies: { zod: "^3", commander: "^12" },
    });

    expect(Object.keys(result.dependencies as Record<string, unknown>)).toEqual(
      ["commander", "zod"]
    );
  });

  test("sorts scripts section alphabetically", () => {
    const result = normalizePackageJsonForWrite({
      name: "pkg",
      scripts: { verify: "...", build: "...", check: "..." },
    });

    expect(Object.keys(result.scripts as Record<string, unknown>)).toEqual([
      "build",
      "check",
      "verify",
    ]);
  });

  test("handles empty object", () => {
    const result = normalizePackageJsonForWrite({});

    expect(result).toEqual({});
  });
});

describe("serializePackageJson", () => {
  test("produces valid JSON with trailing newline", () => {
    const output = serializePackageJson({ name: "pkg", version: "1.0.0" });

    expect(output).toEndWith("\n");
    expect(JSON.parse(output)).toEqual({ name: "pkg", version: "1.0.0" });
  });
});

import { describe, expect, test } from "bun:test";

import {
  extractPackageName,
  isPackageSourceFile,
  normalizeFilePath,
} from "../rules/shared.js";

describe("isPackageSourceFile", () => {
  test("returns true for package source files", () => {
    expect(isPackageSourceFile("packages/cli/src/cli.ts")).toBe(true);
    expect(isPackageSourceFile("/abs/packages/docs/src/search.ts")).toBe(true);
  });

  test("returns false for test files", () => {
    expect(isPackageSourceFile("packages/cli/src/__tests__/core.test.ts")).toBe(
      false
    );
    expect(isPackageSourceFile("packages/cli/src/cli.test.ts")).toBe(false);
    expect(isPackageSourceFile("packages/cli/src/cli.spec.ts")).toBe(false);
  });

  test("returns false for template files", () => {
    // These paths fail PACKAGES_SRC_PATTERN before reaching TEMPLATE_FILE_PATTERN
    // (nested presets/ directory doesn't match packages/*/src/ pattern)
    expect(
      isPackageSourceFile("packages/presets/presets/cli/src/index.template.ts")
    ).toBe(false);
    expect(
      isPackageSourceFile(
        "packages/presets/presets/basic/src/index.test.template.ts"
      )
    ).toBe(false);

    // These paths DO match PACKAGES_SRC_PATTERN and exercise TEMPLATE_FILE_PATTERN
    expect(
      isPackageSourceFile("packages/presets/src/handlers.template.ts")
    ).toBe(false);
    expect(isPackageSourceFile("packages/cli/src/scaffold.template.tsx")).toBe(
      false
    );
  });

  test("returns false for app files", () => {
    expect(isPackageSourceFile("apps/outfitter/src/main.ts")).toBe(false);
  });

  test("returns false for undefined/empty", () => {
    expect(isPackageSourceFile(undefined)).toBe(false);
    expect(isPackageSourceFile("")).toBe(false);
  });
});

describe("extractPackageName", () => {
  test("extracts package name from path", () => {
    expect(extractPackageName("packages/cli/src/cli.ts")).toBe("cli");
    expect(extractPackageName("packages/docs/src/internal/search.ts")).toBe(
      "docs"
    );
  });

  test("returns undefined for non-package paths", () => {
    expect(extractPackageName("apps/outfitter/src/main.ts")).toBeUndefined();
    expect(extractPackageName(undefined)).toBeUndefined();
  });
});

describe("normalizeFilePath", () => {
  test("replaces backslashes with forward slashes", () => {
    expect(normalizeFilePath("packages\\cli\\src\\cli.ts")).toBe(
      "packages/cli/src/cli.ts"
    );
  });

  test("leaves forward slashes unchanged", () => {
    expect(normalizeFilePath("packages/cli/src/cli.ts")).toBe(
      "packages/cli/src/cli.ts"
    );
  });
});

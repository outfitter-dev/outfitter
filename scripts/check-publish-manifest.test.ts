import { describe, expect, test } from "bun:test";

import {
  findRepositoryUrlViolation,
  findWorkspaceRangeViolations,
} from "./check-publish-manifest";

describe("findWorkspaceRangeViolations", () => {
  test("returns empty array when no workspace ranges are present", () => {
    const violations = findWorkspaceRangeViolations({
      name: "@outfitter/example",
      dependencies: {
        zod: "^4.3.5",
      },
      peerDependencies: {
        typescript: "^5.9.0",
      },
    });

    expect(violations).toEqual([]);
  });

  test("returns violations for all dependency sections", () => {
    const violations = findWorkspaceRangeViolations({
      name: "@outfitter/example",
      dependencies: {
        "@outfitter/contracts": "workspace:*",
      },
      devDependencies: {
        "@outfitter/schema": "workspace:^",
      },
      peerDependencies: {
        "@outfitter/types": "workspace:~",
      },
      optionalDependencies: {
        "@outfitter/file-ops": "workspace:0.2.0",
      },
    });

    expect(violations).toEqual([
      {
        section: "dependencies",
        dependency: "@outfitter/contracts",
        range: "workspace:*",
      },
      {
        section: "devDependencies",
        dependency: "@outfitter/schema",
        range: "workspace:^",
      },
      {
        section: "peerDependencies",
        dependency: "@outfitter/types",
        range: "workspace:~",
      },
      {
        section: "optionalDependencies",
        dependency: "@outfitter/file-ops",
        range: "workspace:0.2.0",
      },
    ]);
  });
});

describe("findRepositoryUrlViolation", () => {
  test("returns null for canonical repository URL", () => {
    const violation = findRepositoryUrlViolation({
      name: "@outfitter/example",
      repository: {
        type: "git",
        url: "https://github.com/outfitter-dev/outfitter.git",
      },
    });

    expect(violation).toBeNull();
  });

  test("returns null for git+https repository URL", () => {
    const violation = findRepositoryUrlViolation({
      name: "@outfitter/example",
      repository: "git+https://github.com/outfitter-dev/outfitter.git",
    });

    expect(violation).toBeNull();
  });

  test("reports violation for wrong repository URL", () => {
    const violation = findRepositoryUrlViolation({
      name: "@outfitter/example",
      repository: {
        type: "git",
        url: "https://github.com/outfitter-dev/stack.git",
      },
    });

    expect(violation).toEqual({
      actual: "https://github.com/outfitter-dev/stack.git",
      expected:
        "https://github.com/outfitter-dev/outfitter(.git) (git+ prefix allowed)",
    });
  });

  test("reports violation for missing repository URL", () => {
    const violation = findRepositoryUrlViolation({
      name: "@outfitter/example",
    });

    expect(violation).toEqual({
      actual: "<missing>",
      expected:
        "https://github.com/outfitter-dev/outfitter(.git) (git+ prefix allowed)",
    });
  });
});

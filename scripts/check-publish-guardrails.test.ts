import { describe, expect, test } from "bun:test";
import {
  findPublishGuardrailViolations,
  REQUIRED_PREPUBLISH_ONLY,
  type WorkspacePackageManifest,
} from "./check-publish-guardrails";

describe("findPublishGuardrailViolations", () => {
  test("ignores private packages", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/private/package.json",
        manifest: {
          name: "@outfitter/private",
          private: true,
        },
      },
      {
        path: "packages/private-with-publish-config/package.json",
        manifest: {
          name: "@outfitter/private-with-publish-config",
          private: true,
        },
      },
    ];

    expect(findPublishGuardrailViolations(packages)).toEqual([]);
  });

  test("flags non-private package without prepublishOnly guard", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/schema/package.json",
        manifest: {
          name: "@outfitter/schema",
          scripts: {},
        },
      },
    ];

    expect(findPublishGuardrailViolations(packages)).toEqual([
      {
        packageName: "@outfitter/schema",
        path: "packages/schema/package.json",
        expected: REQUIRED_PREPUBLISH_ONLY,
        actual: undefined,
      },
    ]);
  });

  test("flags non-private package with the wrong guard command", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/schema/package.json",
        manifest: {
          name: "@outfitter/schema",
          scripts: {
            prepublishOnly: "echo nope",
          },
        },
      },
    ];

    expect(findPublishGuardrailViolations(packages)).toEqual([
      {
        packageName: "@outfitter/schema",
        path: "packages/schema/package.json",
        expected: REQUIRED_PREPUBLISH_ONLY,
        actual: "echo nope",
      },
    ]);
  });

  test("accepts non-private package with required guard command", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/schema/package.json",
        manifest: {
          name: "@outfitter/schema",
          scripts: {
            prepublishOnly: REQUIRED_PREPUBLISH_ONLY,
          },
        },
      },
    ];

    expect(findPublishGuardrailViolations(packages)).toEqual([]);
  });
});

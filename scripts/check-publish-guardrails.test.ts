import { describe, expect, test } from "bun:test";
import {
  findPublishGuardrailViolations,
  REQUIRED_PREPUBLISH_ONLY,
  type WorkspacePackageManifest,
} from "./check-publish-guardrails";

describe("findPublishGuardrailViolations", () => {
  test("ignores non-publishable packages", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/private/package.json",
        manifest: {
          name: "@outfitter/private",
          private: true,
        },
      },
      {
        path: "packages/local-only/package.json",
        manifest: {
          name: "@outfitter/local-only",
          scripts: {
            prepublishOnly: "echo ok",
          },
        },
      },
    ];

    expect(findPublishGuardrailViolations(packages)).toEqual([]);
  });

  test("flags publishable package without prepublishOnly guard", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/schema/package.json",
        manifest: {
          name: "@outfitter/schema",
          publishConfig: { access: "public" },
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

  test("flags publishable package with the wrong guard command", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/schema/package.json",
        manifest: {
          name: "@outfitter/schema",
          publishConfig: { access: "public" },
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

  test("accepts publishable package with required guard command", () => {
    const packages: WorkspacePackageManifest[] = [
      {
        path: "packages/schema/package.json",
        manifest: {
          name: "@outfitter/schema",
          publishConfig: { access: "public" },
          scripts: {
            prepublishOnly: REQUIRED_PREPUBLISH_ONLY,
          },
        },
      },
    ];

    expect(findPublishGuardrailViolations(packages)).toEqual([]);
  });
});

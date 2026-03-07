import { describe, expect, test } from "bun:test";

import * as engine from "../engine/index.js";

describe("engine exports", () => {
  test("exposes the current public engine runtime surface without legacy template aliases", () => {
    expect(Object.keys(engine).toSorted()).toEqual([
      "ScaffoldError",
      "addBlocks",
      "buildWorkspaceRootPackageJson",
      "copyPresetFiles",
      "deriveBinName",
      "deriveProjectName",
      "detectWorkspaceRoot",
      "executePlan",
      "getOutputFilename",
      "getPresetsBaseDir",
      "injectSharedConfig",
      "isBinaryFile",
      "isPathWithin",
      "replacePlaceholders",
      "resolveAuthor",
      "resolvePackageName",
      "resolveYear",
      "rewriteLocalDependencies",
      "sanitizePackageName",
      "scaffoldWorkspaceRoot",
      "validatePackageName",
      "validateProjectDirectoryName",
    ]);
  });
});

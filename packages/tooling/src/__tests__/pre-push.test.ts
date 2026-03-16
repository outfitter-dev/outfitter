import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  areFilesTestOnly,
  canBypassRedPhaseByChangedFiles,
  categorizeChangedFiles,
  checkBunVersion,
  createVerificationPlan,
  hasPackageSourceChanges,
  isRedPhaseBranch,
  isReleaseBranch,
  isScaffoldBranch,
  isTestOnlyPath,
} from "../cli/pre-push.js";

describe("pre-push branch detection", () => {
  test("detects red-phase branch suffixes", () => {
    expect(isRedPhaseBranch("feature/new-logging-tests")).toBe(true);
    expect(isRedPhaseBranch("feature/new-logging/tests")).toBe(true);
    expect(isRedPhaseBranch("feature/new-logging_tests")).toBe(true);
  });

  test("does not treat normal feature branch as red phase", () => {
    expect(isRedPhaseBranch("feature/new-logging")).toBe(false);
  });

  test("detects scaffold branch suffixes", () => {
    expect(isScaffoldBranch("feature/logging-scaffold")).toBe(true);
    expect(isScaffoldBranch("feature/logging/scaffold")).toBe(true);
    expect(isScaffoldBranch("feature/logging_scaffold")).toBe(true);
  });

  test("detects changeset release branches", () => {
    expect(isReleaseBranch("changeset-release/main")).toBe(true);
    expect(isReleaseBranch("changeset-release/feature")).toBe(true);
    expect(isReleaseBranch("feature/normal")).toBe(false);
  });
});

describe("createVerificationPlan", () => {
  test("prefers verify:push when available", () => {
    const plan = createVerificationPlan({
      "verify:push": "OUTFITTER_CHECK_COMMAND_PROFILE=hook bun run check --ci",
      "verify:ci":
        "bun run typecheck && bun run check && bun run build && bun run test",
      test: "bun test",
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    expect(plan.source).toBe("verify:push");
    expect(plan.scripts).toEqual(["verify:push"]);
  });

  test("prefers verify:ci when available", () => {
    const plan = createVerificationPlan({
      "verify:ci":
        "bun run typecheck && bun run check && bun run build && bun run test",
      test: "bun test",
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    expect(plan.source).toBe("verify:ci");
    expect(plan.scripts).toEqual(["verify:ci"]);
  });

  test("uses strict fallback with check when verify:ci is missing", () => {
    const plan = createVerificationPlan({
      typecheck: "tsc --noEmit",
      check: "ultracite check",
      build: "bun build src/index.ts",
      test: "bun test",
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    expect(plan.source).toBe("fallback");
    expect(plan.scripts).toEqual(["typecheck", "check", "build", "test"]);
  });

  test("uses lint in fallback when check is missing", () => {
    const plan = createVerificationPlan({
      typecheck: "tsc --noEmit",
      lint: "oxlint .",
      build: "bun build src/index.ts",
      test: "bun test",
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) {
      return;
    }

    expect(plan.source).toBe("fallback");
    expect(plan.scripts).toEqual(["typecheck", "lint", "build", "test"]);
  });

  test("returns error when strict fallback scripts are missing", () => {
    const plan = createVerificationPlan({
      typecheck: "tsc --noEmit",
      test: "bun test",
    });

    expect(plan.ok).toBe(false);
    if (plan.ok) {
      return;
    }

    expect(plan.error).toContain("build");
    expect(plan.error).toContain("check|lint");
  });
});

describe("test-only path detection", () => {
  test("recognizes common test file patterns", () => {
    expect(isTestOnlyPath("src/__tests__/service.test.ts")).toBe(true);
    expect(isTestOnlyPath("src/foo.spec.ts")).toBe(true);
    expect(isTestOnlyPath("src/__snapshots__/service.snap")).toBe(true);
    expect(isTestOnlyPath("vitest.config.ts")).toBe(true);
  });

  test("rejects non-test source files", () => {
    expect(isTestOnlyPath("src/service.ts")).toBe(false);
    expect(isTestOnlyPath("src/index.ts")).toBe(false);
    expect(isTestOnlyPath("package.json")).toBe(false);
  });

  test("requires all changed files to be test-related", () => {
    expect(
      areFilesTestOnly(["src/__tests__/service.test.ts", "src/foo.spec.ts"])
    ).toBe(true);
    expect(
      areFilesTestOnly(["src/__tests__/service.test.ts", "src/service.ts"])
    ).toBe(false);
    expect(areFilesTestOnly([])).toBe(false);
  });
});

describe("red-phase bypass safety", () => {
  test("requires deterministic diff range", () => {
    expect(
      canBypassRedPhaseByChangedFiles({
        files: ["src/__tests__/service.test.ts"],
        deterministic: false,
        source: "undetermined",
      })
    ).toBe(false);
  });

  test("allows bypass only for deterministic test-only changes", () => {
    expect(
      canBypassRedPhaseByChangedFiles({
        files: ["src/__tests__/service.test.ts", "src/foo.spec.ts"],
        deterministic: true,
        source: "upstream",
      })
    ).toBe(true);
  });

  test("denies bypass when deterministic range includes non-test files", () => {
    expect(
      canBypassRedPhaseByChangedFiles({
        files: ["src/__tests__/service.test.ts", "src/service.ts"],
        deterministic: true,
        source: "baseRef",
      })
    ).toBe(false);
  });
});

describe("hasPackageSourceChanges", () => {
  test("returns true when changed files include package source files", () => {
    expect(
      hasPackageSourceChanges({
        files: ["packages/cli/src/index.ts", "README.md"],
        deterministic: true,
        source: "upstream",
      })
    ).toBe(true);
  });

  test("returns true for nested package source paths", () => {
    expect(
      hasPackageSourceChanges({
        files: ["packages/config/src/utils/helpers.ts"],
        deterministic: true,
        source: "baseRef",
      })
    ).toBe(true);
  });

  test("returns false when no package source files are changed", () => {
    expect(
      hasPackageSourceChanges({
        files: ["README.md", "package.json", ".github/workflows/ci.yml"],
        deterministic: true,
        source: "upstream",
      })
    ).toBe(false);
  });

  test("returns false for empty file list", () => {
    expect(
      hasPackageSourceChanges({
        files: [],
        deterministic: false,
        source: "undetermined",
      })
    ).toBe(false);
  });

  test("returns true for test files within packages", () => {
    expect(
      hasPackageSourceChanges({
        files: ["packages/cli/src/__tests__/cli.test.ts"],
        deterministic: true,
        source: "upstream",
      })
    ).toBe(true);
  });

  test("returns false for package files outside src", () => {
    expect(
      hasPackageSourceChanges({
        files: ["packages/cli/package.json", "packages/cli/README.md"],
        deterministic: true,
        source: "upstream",
      })
    ).toBe(false);
  });
});

describe("checkBunVersion", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `pre-push-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("returns match when .bun-version matches runtime version", () => {
    writeFileSync(join(tempDir, ".bun-version"), `${Bun.version}\n`);
    const result = checkBunVersion(tempDir);
    expect(result.matches).toBe(true);
  });

  test("returns mismatch when .bun-version differs from runtime version", () => {
    writeFileSync(join(tempDir, ".bun-version"), "0.0.1\n");
    const result = checkBunVersion(tempDir);
    expect(result.matches).toBe(false);
    expect(result.expected).toBe("0.0.1");
    expect(result.actual).toBe(Bun.version);
  });

  test("returns match when .bun-version is missing", () => {
    const result = checkBunVersion(tempDir);
    expect(result.matches).toBe(true);
  });

  test("trims whitespace from .bun-version content", () => {
    writeFileSync(join(tempDir, ".bun-version"), `  ${Bun.version}  \n`);
    const result = checkBunVersion(tempDir);
    expect(result.matches).toBe(true);
  });
});

describe("categorizeChangedFiles", () => {
  test("requires full suite for core package changes", () => {
    const result = categorizeChangedFiles({
      files: ["packages/contracts/src/result.ts"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("core");
  });

  test("requires full suite for runtime package changes", () => {
    const result = categorizeChangedFiles({
      files: ["packages/cli/src/command.ts"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("runtime");
  });

  test("requires full suite for app changes", () => {
    const result = categorizeChangedFiles({
      files: ["apps/outfitter/src/commands/check.ts"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("app");
  });

  test("requires full suite for CI config changes", () => {
    const result = categorizeChangedFiles({
      files: [".github/workflows/ci.yml"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("ci");
  });

  test("requires full suite for turbo.json changes", () => {
    const result = categorizeChangedFiles({
      files: ["turbo.json"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("ci");
  });

  test("scoped verification for template-only changes", () => {
    const result = categorizeChangedFiles({
      files: [
        "packages/presets/presets/minimal/src/index.ts.template",
        "packages/presets/presets/minimal/src/index.test.ts.template",
      ],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(false);
    expect(result.scope).toBe("template");
  });

  test("scoped verification for docs-only changes", () => {
    const result = categorizeChangedFiles({
      files: ["docs/reference/patterns.md", "docs/ARCHITECTURE.md"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(false);
    expect(result.scope).toBe("docs");
  });

  test("scoped verification for plugin-only changes", () => {
    const result = categorizeChangedFiles({
      files: ["plugins/fieldguides/skills/tdd/SKILL.md"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(false);
    expect(result.scope).toBe("docs");
  });

  test("requires full suite for tooling package changes", () => {
    const result = categorizeChangedFiles({
      files: ["packages/tooling/src/cli/pre-push.ts"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("tooling");
  });

  test("full suite when mix includes core files", () => {
    const result = categorizeChangedFiles({
      files: ["docs/reference/patterns.md", "packages/contracts/src/result.ts"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("core");
  });

  test("full suite when files are not deterministic", () => {
    const result = categorizeChangedFiles({
      files: [],
      deterministic: false,
      source: "undetermined",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("config");
  });

  test("full suite for empty-but-deterministic file list (tag push)", () => {
    const result = categorizeChangedFiles({
      files: [],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("config");
  });

  test("full suite for unknown file paths (conservative)", () => {
    const result = categorizeChangedFiles({
      files: ["some-unknown-directory/file.txt"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("config");
  });

  test("template scope wins over config in mixed lightweight push", () => {
    const result = categorizeChangedFiles({
      files: [
        ".lefthook.yml",
        "packages/presets/presets/minimal/src/index.ts.template",
      ],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(false);
    expect(result.scope).toBe("template");
  });

  test("config scope wins over docs in mixed lightweight push", () => {
    const result = categorizeChangedFiles({
      files: ["docs/ARCHITECTURE.md", ".lefthook.yml"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(false);
    expect(result.scope).toBe("config");
  });

  test("scoped for config-only changes", () => {
    const result = categorizeChangedFiles({
      files: [".lefthook.yml", "scripts/kill-stale-hooks.sh"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(false);
    expect(result.scope).toBe("config");
  });

  test("plugin executable files require full suite", () => {
    const result = categorizeChangedFiles({
      files: ["plugins/fieldguides/scripts/validate-skill-frontmatter.ts"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("app");
  });

  test("plugin non-executable files are docs scope", () => {
    const result = categorizeChangedFiles({
      files: [
        "plugins/fieldguides/skills/tdd/SKILL.md",
        "plugins/fieldguides/plugin.json",
      ],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(false);
    expect(result.scope).toBe("docs");
  });

  test("full suite when mix includes plugin executable and docs", () => {
    const result = categorizeChangedFiles({
      files: [
        "plugins/fieldguides/skills/tdd/SKILL.md",
        "plugins/fieldguides/scripts/validate.ts",
      ],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("app");
  });

  test("presets non-template files require full suite", () => {
    const result = categorizeChangedFiles({
      files: ["packages/presets/src/scaffold.ts"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("runtime");
  });

  test("non-template files in presets/presets/ require full suite", () => {
    const result = categorizeChangedFiles({
      files: ["packages/presets/presets/minimal/package.json"],
      deterministic: true,
      source: "upstream",
    });
    expect(result.requiresFullSuite).toBe(true);
    expect(result.scope).toBe("runtime");
  });
});

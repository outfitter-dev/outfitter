import { describe, expect, test } from "bun:test";
import {
	areFilesTestOnly,
	canBypassRedPhaseByChangedFiles,
	createVerificationPlan,
	hasPackageSourceChanges,
	isRedPhaseBranch,
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
});

describe("createVerificationPlan", () => {
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
			lint: "biome check .",
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
			areFilesTestOnly(["src/__tests__/service.test.ts", "src/foo.spec.ts"]),
		).toBe(true);
		expect(
			areFilesTestOnly(["src/__tests__/service.test.ts", "src/service.ts"]),
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
			}),
		).toBe(false);
	});

	test("allows bypass only for deterministic test-only changes", () => {
		expect(
			canBypassRedPhaseByChangedFiles({
				files: ["src/__tests__/service.test.ts", "src/foo.spec.ts"],
				deterministic: true,
				source: "upstream",
			}),
		).toBe(true);
	});

	test("denies bypass when deterministic range includes non-test files", () => {
		expect(
			canBypassRedPhaseByChangedFiles({
				files: ["src/__tests__/service.test.ts", "src/service.ts"],
				deterministic: true,
				source: "baseRef",
			}),
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
			}),
		).toBe(true);
	});

	test("returns true for nested package source paths", () => {
		expect(
			hasPackageSourceChanges({
				files: ["packages/config/src/utils/helpers.ts"],
				deterministic: true,
				source: "baseRef",
			}),
		).toBe(true);
	});

	test("returns false when no package source files are changed", () => {
		expect(
			hasPackageSourceChanges({
				files: ["README.md", "package.json", ".github/workflows/ci.yml"],
				deterministic: true,
				source: "upstream",
			}),
		).toBe(false);
	});

	test("returns false for empty file list", () => {
		expect(
			hasPackageSourceChanges({
				files: [],
				deterministic: false,
				source: "undetermined",
			}),
		).toBe(false);
	});

	test("returns false for test files within packages", () => {
		expect(
			hasPackageSourceChanges({
				files: ["packages/cli/src/__tests__/cli.test.ts"],
				deterministic: true,
				source: "upstream",
			}),
		).toBe(true);
	});

	test("returns false for package files outside src", () => {
		expect(
			hasPackageSourceChanges({
				files: ["packages/cli/package.json", "packages/cli/README.md"],
				deterministic: true,
				source: "upstream",
			}),
		).toBe(false);
	});
});

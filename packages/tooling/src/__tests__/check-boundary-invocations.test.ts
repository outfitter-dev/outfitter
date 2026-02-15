import { describe, expect, test } from "bun:test";
import {
	detectBoundaryViolation,
	findBoundaryViolations,
} from "../cli/check-boundary-invocations.js";

describe("detectBoundaryViolation", () => {
	test("flags direct root invocation of packages/*/src", () => {
		const violation = detectBoundaryViolation({
			file: "package.json",
			scriptName: "check-readme-imports",
			command: "bun run packages/tooling/src/cli/index.ts check-readme-imports",
		});

		expect(violation?.rule).toBe("root-runs-package-src");
	});

	test("flags cd packages/* then run src command", () => {
		const violation = detectBoundaryViolation({
			file: "package.json",
			scriptName: "docs:sync:core",
			command: "cd packages/docs-core && bun src/cli-sync.ts --cwd ../..",
		});

		expect(violation?.rule).toBe("cd-package-then-runs-src");
	});

	test("does not flag canonical app-surface invocation", () => {
		const violation = detectBoundaryViolation({
			file: "package.json",
			scriptName: "check-exports",
			command: "bun run apps/outfitter/src/cli.ts repo check exports --cwd .",
		});

		expect(violation).toBeNull();
	});
});

describe("findBoundaryViolations", () => {
	test("collects and sorts violations from multiple script maps", () => {
		const violations = findBoundaryViolations([
			{
				file: "apps/outfitter/package.json",
				scripts: {
					ok: "bun run src/cli.ts",
				},
			},
			{
				file: "package.json",
				scripts: {
					"docs:sync:core":
						"cd packages/docs-core && bun src/cli-sync.ts --cwd ../..",
					"check-readme-imports":
						"bun run packages/tooling/src/cli/index.ts check-readme-imports",
				},
			},
		]);

		expect(violations).toHaveLength(2);
		expect(violations[0]?.scriptName).toBe("check-readme-imports");
		expect(violations[1]?.scriptName).toBe("docs:sync:core");
	});
});

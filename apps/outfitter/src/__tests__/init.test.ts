import { afterEach, beforeEach, expect, test } from "bun:test";

import { InitError, runInit } from "../index.js";

let originalIsTTY: boolean | undefined;

beforeEach(() => {
	originalIsTTY = process.stdout.isTTY;
	Object.defineProperty(process.stdout, "isTTY", {
		value: false,
		writable: true,
		configurable: true,
	});
});

afterEach(() => {
	Object.defineProperty(process.stdout, "isTTY", {
		value: originalIsTTY,
		writable: true,
		configurable: true,
	});
});

test("runInit returns a helpful error for missing templates", async () => {
	const result = await runInit({
		targetDir: "./tmp-outfitter-missing-template",
		template: "does-not-exist",
		force: false,
	});

	expect(result.isErr()).toBe(true);

	if (result.isErr()) {
		expect(result.error).toBeInstanceOf(InitError);
		expect(result.error.message).toContain("Template");
	}
});

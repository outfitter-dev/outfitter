import { describe, expect, it } from "bun:test";
import * as index from "../index.js";

describe("@outfitter/index", () => {
	it("loads the module entrypoint", () => {
		expect(index).toBeDefined();
	});
});

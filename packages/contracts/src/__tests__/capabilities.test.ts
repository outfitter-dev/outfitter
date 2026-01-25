/**
 * @outfitter/contracts - capability manifest tests
 */

import { describe, expect, it } from "bun:test";
import {
	ACTION_CAPABILITIES,
	CAPABILITY_SURFACES,
	DEFAULT_ACTION_SURFACES,
	capability,
	capabilityAll,
	getActionsForSurface,
} from "../capabilities.js";

describe("capability helpers", () => {
	it("defaults to CLI+MCP surfaces", () => {
		expect(capability().surfaces).toEqual(DEFAULT_ACTION_SURFACES);
	});

	it("supports all surfaces helper", () => {
		expect(capabilityAll().surfaces).toEqual(CAPABILITY_SURFACES);
	});
});

describe("action manifest", () => {
	it("includes server-only actions", () => {
		expect(ACTION_CAPABILITIES.download.surfaces).toEqual(["server"]);
	});

	it("filters actions by surface", () => {
		const serverActions = getActionsForSurface("server");
		expect(serverActions).toContain("download");
		expect(serverActions).not.toContain("navigate");

		const mcpActions = getActionsForSurface("mcp");
		expect(mcpActions).toContain("navigate");
		expect(mcpActions).not.toContain("download");
	});
});

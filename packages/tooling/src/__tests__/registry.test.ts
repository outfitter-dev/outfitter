import { describe, expect, test } from "bun:test";
import {
	BlockSchema,
	FileEntrySchema,
	RegistrySchema,
} from "../registry/schema.js";

describe("FileEntrySchema", () => {
	test("validates minimal file entry", () => {
		const entry = {
			path: ".claude/settings.json",
			content: "{}",
		};
		const result = FileEntrySchema.parse(entry);
		expect(result.path).toBe(".claude/settings.json");
		expect(result.content).toBe("{}");
		expect(result.executable).toBeUndefined();
	});

	test("validates file entry with executable flag", () => {
		const entry = {
			path: "scripts/bootstrap.sh",
			content: "#!/usr/bin/env bash\necho hello",
			executable: true,
		};
		const result = FileEntrySchema.parse(entry);
		expect(result.executable).toBe(true);
	});

	test("rejects empty path", () => {
		const entry = {
			path: "",
			content: "content",
		};
		expect(() => FileEntrySchema.parse(entry)).toThrow();
	});
});

describe("BlockSchema", () => {
	test("validates block with files", () => {
		const block = {
			name: "claude",
			description: "Claude Code settings and hooks",
			files: [
				{ path: ".claude/settings.json", content: "{}" },
				{
					path: ".claude/hooks/format.sh",
					content: "#!/bin/bash",
					executable: true,
				},
			],
		};
		const result = BlockSchema.parse(block);
		expect(result.name).toBe("claude");
		expect(result.files).toHaveLength(2);
	});

	test("validates block with dependencies", () => {
		const block = {
			name: "biome",
			description: "Biome configuration",
			files: [{ path: "biome.json", content: "{}" }],
			devDependencies: {
				ultracite: "^7.0.0",
			},
		};
		const result = BlockSchema.parse(block);
		expect(result.devDependencies?.ultracite).toBe("^7.0.0");
	});

	test("validates composite block with extends", () => {
		const block = {
			name: "scaffolding",
			description: "Full starter kit",
			extends: ["claude", "biome", "lefthook", "bootstrap"],
		};
		const result = BlockSchema.parse(block);
		expect(result.extends).toHaveLength(4);
		expect(result.files).toBeUndefined();
	});
});

describe("RegistrySchema", () => {
	test("validates complete registry", () => {
		const registry = {
			version: "1.0.0",
			blocks: {
				claude: {
					name: "claude",
					description: "Claude Code settings",
					files: [{ path: ".claude/settings.json", content: "{}" }],
				},
				biome: {
					name: "biome",
					description: "Biome configuration",
					files: [{ path: "biome.json", content: "{}" }],
					devDependencies: { ultracite: "^7.0.0" },
				},
				scaffolding: {
					name: "scaffolding",
					description: "Full starter kit",
					extends: ["claude", "biome"],
				},
			},
		};
		const result = RegistrySchema.parse(registry);
		expect(result.version).toBe("1.0.0");
		expect(Object.keys(result.blocks)).toHaveLength(3);
	});
});

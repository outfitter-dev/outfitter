import { describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFixture, loadFixture, withEnv, withTempDir } from "../fixtures.js";

describe("fixtures", () => {
	it("createFixture deep merges overrides without mutating defaults", () => {
		const createUser = createFixture({
			id: 1,
			name: "Ada",
			settings: { theme: "dark", notifications: true },
			tags: ["alpha", "beta"],
		});

		const user = createUser({ settings: { theme: "light" }, tags: ["gamma"] });

		expect(user).toEqual({
			id: 1,
			name: "Ada",
			settings: { theme: "light", notifications: true },
			tags: ["gamma"],
		});

		user.settings.theme = "mutated";
		expect(createUser().settings.theme).toBe("dark");
	});

	it("withTempDir creates and cleans up directories", async () => {
		let tempDir = "";

		await withTempDir(async (dir) => {
			tempDir = dir;
			const filePath = join(dir, "note.txt");
			await writeFile(filePath, "hello");
		});

		let existsAfter = true;
		try {
			await writeFile(join(tempDir, "should-not-exist.txt"), "nope");
		} catch {
			existsAfter = false;
		}

		expect(existsAfter).toBe(false);
	});

	it("withEnv restores environment variables", async () => {
		const key = "OUTFITTER_TEST_ENV";
		const original = process.env[key];

		await withEnv({ [key]: "value" }, async () => {
			expect(process.env[key]).toBe("value");
		});

		if (original === undefined) {
			expect(process.env[key]).toBeUndefined();
		} else {
			expect(process.env[key]).toBe(original);
		}
	});

	it("loadFixture reads JSON and text fixtures", async () => {
		await withTempDir(async (dir) => {
			const jsonPath = join(dir, "data.json");
			const textPath = join(dir, "note.txt");

			await writeFile(jsonPath, JSON.stringify({ id: 123, name: "note" }));
			await writeFile(textPath, "plain text");

			const data = loadFixture<{ id: number; name: string }>("data.json", {
				fixturesDir: dir,
			});
			const note = loadFixture("note.txt", { fixturesDir: dir });

			expect(data).toEqual({ id: 123, name: "note" });
			expect(note).toBe("plain text");
		});
	});
});

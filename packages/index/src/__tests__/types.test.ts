import { describe, expect, it } from "bun:test";
import type { IndexOptions, SearchQuery } from "../index.js";

describe("index types", () => {
	it("accepts IndexOptions shape", () => {
		const options: IndexOptions = {
			path: "/tmp/outfitter-index.db",
			tableName: "documents",
			tokenizer: "unicode61",
		};

		expect(options.path).toBe("/tmp/outfitter-index.db");
	});

	it("accepts SearchQuery shape", () => {
		const query: SearchQuery = {
			query: "hello world",
			limit: 10,
			offset: 5,
		};

		expect(query.query).toBe("hello world");
	});
});

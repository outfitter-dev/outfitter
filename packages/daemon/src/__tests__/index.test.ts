import { describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDaemon } from "../index.js";

describe("@outfitter/daemon", () => {
	it("creates a daemon instance with lifecycle helpers", () => {
		const daemon = createDaemon({
			name: "test-daemon",
			pidFile: join(tmpdir(), "outfitter-daemon-test.pid"),
		});

		expect(daemon).toBeDefined();
		expect(typeof daemon.start).toBe("function");
		expect(typeof daemon.stop).toBe("function");
	});
});
